import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { currentSession, requireCsrf, requireRole } from '../auth/session.js'
import { pageBounds, pagination, parseQuery, productSlug, searchPrefix, toProductSlug, versionField } from '../business-inputs.js'
import { contractRow, contractRowSelect } from '../contracts/model.js'
import { quoteRow, quoteRowSelect } from '../quotes/model.js'
import { recordHistory, staffAudit, staleRecord } from '../staff-records.js'
import { createPartner, eligiblePartner, partnerFields, partnerRow, partnerWebsite, resolveCategories } from './model.js'

const lifecycle = { isActive: z.boolean().optional(), isPublished: z.boolean().optional() }
const create = partnerFields.extend(lifecycle)
const edit = partnerFields.partial().extend({ version: versionField, ...lifecycle }).refine(body => Object.keys(body).length > 1)
const verify = z.strictObject({ version: versionField, reference: z.string().trim().min(3).max(160) })
export const partnerList = z.strictObject({
  ...pagination, active: z.enum(['true', 'false']).optional(),
  status: z.enum(['UNVERIFIED', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'PUBLISHED']).optional(),
  productSlug: productSlug.optional(),
})
const rowFields = { id: true, name: true, displayName: true, categories: true, isActive: true, isPublished: true, verifiedAt: true, version: true } as const
const states: Record<NonNullable<z.infer<typeof partnerList>['status']>, Prisma.PartnerWhereInput> = {
  UNVERIFIED: { verifiedAt: null }, VERIFIED: { verifiedAt: { not: null } }, ACTIVE: eligiblePartner,
  INACTIVE: { isActive: false }, PUBLISHED: { ...eligiblePartner, isPublished: true },
}

function stateConflict(message: string) {
  return new ApiError(409, 'PARTNER_STATE', message)
}

function uniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ApiError(409, 'PARTNER_DUPLICATE', 'Une compagnie existe déjà sous ce nom.')
  }
  throw error
}

async function lockedPartner(db: Prisma.TransactionClient, id: string, version: number) {
  const [row] = await db.$queryRaw<{ id: string }[]>`SELECT id FROM partners WHERE id=${id}::uuid FOR UPDATE`
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Compagnie introuvable.')
  const partner = await db.partner.findUniqueOrThrow({ where: { id } })
  if (partner.version !== version) throw staleRecord()
  return partner
}

async function detail(db: Prisma.TransactionClient, id: string) {
  const row = await db.partner.findUnique({ where: { id }, select: {
    ...rowFields, website: true, contactPerson: true, phone: true, email: true, address: true, internalNotes: true,
    createdAt: true, updatedAt: true, verificationReference: true, verifier: { select: { displayName: true } },
    quotes: { select: quoteRowSelect, take: 8, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    contracts: { select: contractRowSelect, take: 8, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
  } })
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Compagnie introuvable.')
  const { quotes, contracts, categories, ...fields } = row
  return { ...fields, categories: partnerRow({ ...row, categories }).categories,
    recentQuotes: quotes.map(quoteRow), recentContracts: contracts.map(contractRow), activity: await recordHistory(db, 'partner', id),
  }
}

export function publicPartnerRoutes(db: PrismaClient) {
  const routes = Router()
  routes.get('/', async (_request, response) => {
    const partners = await db.partner.findMany({
      where: { ...eligiblePartner, isPublished: true },
      select: { name: true, displayName: true, website: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
    response.json({ data: partners.map(row => ({ name: row.displayName ?? row.name, website: partnerWebsite.safeParse(row.website).data ?? null })) })
  })
  return routes
}

export function partnerWhere(input: z.infer<typeof partnerList>) {
  const search = input.q && searchPrefix(input.q)
  const where: Prisma.PartnerWhereInput = {
    AND: [
      input.status ? states[input.status] : {},
      input.active === undefined ? {} : { isActive: input.active === 'true' },
      input.productSlug ? { categories: { has: toProductSlug(input.productSlug) } } : {},
      search ? { OR: [{ name: { startsWith: search, mode: 'insensitive' } }, { displayName: { startsWith: search, mode: 'insensitive' } }] } : {},
    ],
  }
  return where
}

export function partnerAdminRoutes(db: PrismaClient) {
  const routes = Router()
  const admin = requireRole('ADMIN')
  routes.get('/', async (request, response) => {
    const input = parseQuery(partnerList, request.query)
    const { page, limit, skip } = pageBounds(input)
    const where = partnerWhere(input)
    const [rows, total] = await db.$transaction([
      db.partner.findMany({ where, skip, take: limit, select: rowFields, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      db.partner.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(partnerRow), meta: { page, limit, total } })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await db.$transaction(async transaction => {
      const record = await detail(transaction, id)
      await staffAudit(transaction, response, 'partner', id, 'RECORD_VIEWED')
      return record
    })
    response.json({ data })
  })
  routes.post('/', admin, requireCsrf, async (request, response) => {
    const { isActive, isPublished, ...input } = jsonBody(request, create)
    if (isActive || isPublished) throw stateConflict('Vérifiez la compagnie avant de l’activer ou de la publier.')
    try {
      const data = await db.$transaction(async transaction => {
        const row = await createPartner(transaction, input)
        await staffAudit(transaction, response, 'partner', row.id, 'PARTNER_CREATED')
        return detail(transaction, row.id)
      })
      response.status(201).json({ data })
    } catch (error) { uniqueConflict(error) }
  })
  routes.patch('/:id', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, categories, isActive, isPublished, ...fields } = jsonBody(request, edit)
    try {
      const data = await db.$transaction(async transaction => {
        const row = await lockedPartner(transaction, id, version)
        const slugs = categories ? await resolveCategories(transaction, categories) : row.categories
        const changedScope = ['name', 'displayName', 'website'].some(key => {
          const field = key as 'name' | 'displayName' | 'website'
          return fields[field] !== undefined && fields[field] !== row[field]
        }) || slugs.length !== row.categories.length || !slugs.every(slug => row.categories.includes(slug))
        const reset = Boolean(row.verifiedAt && changedScope)
        const verified = Boolean(row.verifiedAt && !reset)
        const active = isActive ?? (verified && row.isActive)
        const published = isPublished ?? (active && row.isPublished)
        if ((active && !verified) || (published && !active)) throw stateConflict('La publication exige une compagnie vérifiée et active.')
        if ((!active || reset) && row.isActive && await transaction.outboxJob.count({ where: {
          kind: 'QUOTE_DELIVERY', state: 'RUNNING', leaseUntil: { gt: new Date() }, document: { quote: { partnerId: id } },
        } })) throw stateConflict('Un devis est en cours d’envoi. Réessayez après son traitement.')
        await transaction.partner.update({ where: { id }, data: {
          ...fields, categories: slugs, isActive: active, isPublished: published, version: { increment: 1 },
          ...(reset ? { verifiedAt: null, verifiedBy: null, verificationReference: null } : {}),
        } })
        await staffAudit(transaction, response, 'partner', id, reset ? 'PARTNER_REVIEW_REQUIRED' : 'PARTNER_UPDATED', {
          fields: Object.keys(fields), categoriesChanged: categories !== undefined, isActive: active, isPublished: published,
        })
        return detail(transaction, id)
      })
      response.json({ data })
    } catch (error) { uniqueConflict(error) }
  })
  routes.post('/:id/verify', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, reference } = jsonBody(request, verify)
    const data = await db.$transaction(async transaction => {
      const row = await lockedPartner(transaction, id, version)
      if (!row.categories.length) throw stateConflict('Ajoutez au moins une catégorie avant la vérification.')
      if (row.website && !partnerWebsite.safeParse(row.website).success) throw stateConflict('Corrigez le site web avant de vérifier la compagnie.')
      await transaction.partner.update({ where: { id }, data: {
        verifiedAt: new Date(), verifiedBy: currentSession(response).user.id, verificationReference: reference, version: { increment: 1 },
      } })
      await staffAudit(transaction, response, 'partner', id, 'PARTNER_VERIFIED')
      return detail(transaction, id)
    })
    response.json({ data })
  })
  return routes
}
