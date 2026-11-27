import { Prisma } from '@prisma/client'
import type { InsuranceProduct, PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { currentSession, requireCsrf, requireRole } from '../auth/session.js'
import { fromProductSlug, parseQuery, productSlug, profile, toProductSlug, versionField } from '../business-inputs.js'

const audienceList = z.array(profile).min(1).max(2).refine(items => new Set(items).size === items.length)
const coverages = z.array(z.strictObject({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000),
})).max(12)
const documentHints = z.array(z.string().trim().min(1).max(1000)).max(10)
const faqs = z.array(z.strictObject({
  question: z.string().trim().min(3).max(180),
  answer: z.string().trim().min(10).max(1000),
})).max(12)

const write = z.strictObject({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(10).max(300),
  audiences: audienceList,
  imageKey: z.null().optional(), // No approved image manifest in this release.
  potentialCoverages: coverages,
  eligibilityText: z.string().trim().max(1000),
  documentHints,
  faqs,
  relatedSlugs: z.array(productSlug).max(6).refine(items => new Set(items).size === items.length),
  isPublished: z.boolean(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(999),
})
const creation = write.extend({ slug: productSlug })
const patch = write.partial().extend({ version: versionField }).refine(changes => Object.keys(changes).some(key => key !== 'version'))
type Write = z.infer<typeof write>
const available = { isActive: true, isPublished: true } satisfies Prisma.InsuranceProductWhereInput

function card(row: Pick<InsuranceProduct, 'id' | 'slug' | 'title' | 'summary' | 'audiences'>) {
  return { id: row.id, slug: fromProductSlug(row.slug), title: row.title, summary: row.summary, audiences: row.audiences }
}

function product(row: InsuranceProduct) {
  return {
    ...card(row),
    potentialCoverages: coverages.safeParse(row.potentialCoverages).data ?? [],
    eligibilityText: row.eligibilityText,
    documentHints: documentHints.safeParse(row.documentHints).data ?? [],
    faqs: faqs.safeParse(row.faqs).data ?? [],
    relatedSlugs: row.relatedSlugs.map(fromProductSlug),
  }
}

function item(row: InsuranceProduct) {
  return { ...product(row), isActive: row.isActive, isPublished: row.isPublished, displayOrder: row.displayOrder, version: row.version }
}

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'Assurance introuvable.')
}

async function catalogChanges(transaction: Prisma.TransactionClient, input: Partial<Write>, slug: InsuranceProduct['slug'], current?: InsuranceProduct) {
  const { relatedSlugs, ...fields } = input
  const mapped = relatedSlugs?.map(toProductSlug)
  if (mapped && (mapped.includes(slug) || await transaction.insuranceProduct.count({ where: { ...available, slug: { in: mapped } } }) !== mapped.length)) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Choisissez des assurances associées publiées et différentes du produit.', { relatedSlugs: 'Produits associés indisponibles.' })
  }

  const isActive = fields.isActive ?? current?.isActive ?? true
  if (!isActive && fields.isPublished === true) throw new ApiError(409, 'INVALID_STATE', 'Activez le produit avant de le publier.')
  return {
    ...fields,
    ...(mapped ? { relatedSlugs: mapped } : {}),
    isActive,
    isPublished: isActive && (fields.isPublished ?? current?.isPublished ?? false),
  }
}

export function publicCatalogRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (request, response) => {
    const { audience } = parseQuery(z.strictObject({ audience: profile.optional() }), request.query)
    const rows = await database.insuranceProduct.findMany({
      where: { ...available, ...(audience ? { audiences: { has: audience } } : {}) },
      select: { id: true, slug: true, title: true, summary: true, audiences: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    })
    response.json({ data: rows.map(card) })
  })
  routes.get('/:slug', async (request, response) => {
    const slug = productSlug.safeParse(request.params.slug)
    if (!slug.success) throw notFound()
    const row = await database.insuranceProduct.findFirst({ where: { ...available, slug: toProductSlug(slug.data) } })
    if (!row) throw notFound()
    const related = await database.insuranceProduct.findMany({
      where: { ...available, slug: { in: row.relatedSlugs } }, select: { slug: true },
    })
    const visible = new Set(related.map(entry => fromProductSlug(entry.slug)))
    const detail = product(row)
    response.json({ data: { ...detail, relatedSlugs: detail.relatedSlugs.filter(value => visible.has(value)) } })
  })
  return routes
}

export function adminCatalogRoutes(database: PrismaClient) {
  const routes = Router()
  const admin = requireRole('ADMIN')

  routes.get('/', async (_request, response) => {
    const rows = await database.insuranceProduct.findMany({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] })
    response.json({ data: rows.map(item) })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const row = await database.insuranceProduct.findUnique({ where: { id } })
    if (!row) throw notFound()
    response.json({ data: item(row) })
  })
  routes.post('/', admin, requireCsrf, async (request, response) => {
    const { slug, ...input } = jsonBody(request, creation)
    const mappedSlug = toProductSlug(slug)
    try {
      const row = await database.$transaction(async transaction => {
        const changes = await catalogChanges(transaction, input, mappedSlug)
        const created = await transaction.insuranceProduct.create({
          data: { ...input, ...changes, slug: mappedSlug, relatedSlugs: input.relatedSlugs.map(toProductSlug) },
        })
        await transaction.auditEvent.create({
          data: { actorId: currentSession(response).user.id, requestId: response.locals.requestId, action: 'CATALOG_CREATED', targetType: 'insurance_product', targetId: created.id },
        })
        return created
      })
      response.status(201).json({ data: item(row) })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'PRODUCT_EXISTS', 'Cette catégorie existe déjà.')
      }
      throw error
    }
  })
  routes.patch('/:id', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, ...input } = jsonBody(request, patch)
    const row = await database.$transaction(async transaction => {
      const current = await transaction.insuranceProduct.findUnique({ where: { id } })
      if (!current) throw notFound()
      if (current.version !== version) throw new ApiError(409, 'STALE_VERSION', 'Le produit a été modifié. Rechargez la fiche.')
      const data = await catalogChanges(transaction, input, current.slug, current)
      const changed = await transaction.insuranceProduct.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } })
      if (changed.count !== 1) throw new ApiError(409, 'STALE_VERSION', 'Le produit a été modifié. Rechargez la fiche.')
      await transaction.auditEvent.create({
        data: { actorId: currentSession(response).user.id, requestId: response.locals.requestId, action: 'CATALOG_UPDATED', targetType: 'insurance_product', targetId: id, metadata: { fields: Object.keys(input), isActive: data.isActive, isPublished: data.isPublished } },
      })
      return transaction.insuranceProduct.findUniqueOrThrow({ where: { id } })
    })
    response.json({ data: item(row) })
  })
  return routes
}
