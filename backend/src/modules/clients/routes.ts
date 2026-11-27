import type { Prisma, PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { emailField } from '../auth/contracts.js'
import { requireCsrf, requireRole } from '../auth/session.js'
import { normalizePhone, pageBounds, pagination, parseQuery, phoneField, profile, searchPrefix, versionField } from '../business-inputs.js'
import { requestRow, requestRowSelect } from '../quote-requests/admin.js'
import { recordHistory, staffAudit, staleRecord } from '../staff-records.js'

const write = z.strictObject({
  profile, displayName: z.string().trim().min(2).max(120), phone: phoneField,
  email: emailField.nullable().optional(), city: z.string().trim().min(2).max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})
const create = write.extend({ confirmDuplicate: z.literal(true).optional() })
const edit = write.partial().extend({
  version: versionField, verify: z.literal(true).optional(), confirmDuplicate: z.literal(true).optional(),
}).refine(body => Object.keys(body).some(key => key !== 'version' && key !== 'confirmDuplicate'))
const list = z.strictObject({
  ...pagination, profile: profile.optional(), archived: z.enum(['true', 'false']).optional(),
  provisional: z.enum(['true', 'false']).optional(),
})
const rowSelect = { id: true, profile: true, displayName: true, phone: true, city: true, archivedAt: true, version: true, intakeProvisional: true } as const
const openRequest = { status: { in: ['NEW', 'IN_REVIEW', 'QUOTE_SENT'] } } satisfies Prisma.QuoteRequestWhereInput

async function duplicates(database: Prisma.TransactionClient, phone?: string, email?: string | null, id?: string, locked = false) {
  const fields: Prisma.ClientWhereInput[] = []
  if (phone) fields.push({ phone })
  if (email) fields.push({ email: { equals: email, mode: 'insensitive' } })
  if (!fields.length) return []
  if (locked) {
    const keys = [phone && 'phone:' + phone, email && 'email:' + email].filter(Boolean).sort()
    for (const key of keys) await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'client:' + key}, 0))`
  }
  return database.client.findMany({
    where: { id: id ? { not: id } : undefined, OR: fields }, take: 10,
    select: { id: true, displayName: true, intakeProvisional: true, archivedAt: true },
    orderBy: [{ archivedAt: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
  })
}

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'Client introuvable.')
}

export function clientRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (request, response) => {
    const input = parseQuery(list, request.query)
    const { page, limit, skip } = pageBounds(input)
    const prefix = input.q && searchPrefix(input.q)
    const where: Prisma.ClientWhereInput = {
      archivedAt: input.archived === 'true' ? { not: null } : null, profile: input.profile,
      intakeProvisional: input.provisional === undefined ? undefined : input.provisional === 'true',
      OR: prefix ? [
        { displayName: { startsWith: prefix, mode: 'insensitive' } },
        { city: { startsWith: prefix, mode: 'insensitive' } },
        { email: { startsWith: prefix, mode: 'insensitive' } },
        { phone: { startsWith: normalizePhone(input.q ?? '') ?? prefix } },
        { requests: { some: { reference: { startsWith: prefix, mode: 'insensitive' } } } },
        { assistance: { some: { reference: { startsWith: prefix, mode: 'insensitive' } } } },
      ] : undefined,
    }
    const [data, total] = await database.$transaction([
      database.client.findMany({ where, skip, take: limit, select: rowSelect, orderBy: [{ intakeProvisional: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }] }),
      database.client.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data, meta: { page, limit, total } })
  })

  routes.post('/duplicates', requireCsrf, async (request, response) => {
    const input = jsonBody(request, z.strictObject({ phone: phoneField, email: emailField.nullable().optional(), excludeId: z.uuid().optional() }))
    response.json({ data: await duplicates(database, input.phone, input.email, input.excludeId) })
  })

  routes.post('/', requireCsrf, async (request, response) => {
    const { confirmDuplicate, ...input } = jsonBody(request, create)
    const data = await database.$transaction(async transaction => {
      const candidates = await duplicates(transaction, input.phone, input.email, undefined, true)
      if (candidates.length && !confirmDuplicate) throw new ApiError(409, 'CLIENT_DUPLICATES', 'Des fiches utilisent ces coordonnées. Vérifiez les correspondances.')
      const client = await transaction.client.create({ data: input })
      await staffAudit(transaction, response, 'client', client.id, 'CLIENT_CREATED', { duplicateConfirmed: Boolean(confirmDuplicate) })
      return client
    })
    response.status(201).json({ data })
  })

  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await database.$transaction(async transaction => {
      const client = await transaction.client.findUnique({
        where: { id }, include: {
          requests: { take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: requestRowSelect },
          assistance: { take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, reference: true, status: true, createdAt: true } },
        },
      })
      if (!client) throw notFound()
      const { requests, assistance, ...fields } = client
      const activity = await recordHistory(transaction, 'client', id)
      await staffAudit(transaction, response, 'client', id, 'RECORD_VIEWED')
      return { ...fields, recentRequests: requests.map(requestRow), recentAssistance: assistance, activity }
    })
    response.json({ data })
  })

  routes.patch('/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, verify, confirmDuplicate, ...changes } = jsonBody(request, edit)
    const data = await database.$transaction(async transaction => {
      const client = await transaction.client.findUnique({ where: { id } })
      if (!client) throw notFound()
      if (client.version !== version) throw staleRecord()
      if (client.archivedAt) throw new ApiError(409, 'CLIENT_ARCHIVED', 'Cette fiche est archivée.')
      const phone = changes.phone ?? client.phone
      const email = changes.email === undefined ? client.email : changes.email
      if (verify || phone !== client.phone || email !== client.email) {
        const candidates = await duplicates(transaction, phone, email, id, true)
        if (candidates.length && !confirmDuplicate) throw new ApiError(409, 'CLIENT_DUPLICATES', 'Des fiches utilisent ces coordonnées. Vérifiez les correspondances.')
      }
      const result = await transaction.client.updateMany({
        where: { id, version, archivedAt: null }, data: { ...changes, intakeProvisional: verify ? false : undefined, version: { increment: 1 } },
      })
      if (!result.count) throw staleRecord()
      await staffAudit(transaction, response, 'client', id, verify && client.intakeProvisional ? 'CLIENT_VERIFIED' : 'CLIENT_UPDATED', {
        fields: Object.keys(changes), duplicateConfirmed: Boolean(confirmDuplicate),
      })
      return transaction.client.findUniqueOrThrow({ where: { id } })
    })
    response.json({ data })
  })

  routes.post('/:id/archive', requireRole('ADMIN'), requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, z.strictObject({ version: versionField }))
    const data = await database.$transaction(async transaction => {
      // Serialize with quote and assistance staff operations that link this client.
      const [locked] = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM clients WHERE id = ${id}::uuid FOR UPDATE`
      if (!locked) throw notFound()
      const client = await transaction.client.findUniqueOrThrow({ where: { id }, select: {
        version: true, archivedAt: true, requests: { where: openRequest, take: 1, select: { id: true } },
        assistance: { where: { status: { not: 'RESOLVED' } }, take: 1, select: { id: true } },
        contracts: { where: { status: 'ACTIVE' }, take: 1, select: { id: true } },
      } })
      if (client.version !== version) throw staleRecord()
      if (client.archivedAt || client.requests.length || client.assistance.length || client.contracts.length) {
        throw new ApiError(409, 'CLIENT_ARCHIVE_BLOCKED', 'La fiche est déjà archivée ou liée à un dossier en cours.')
      }
      const archived = await transaction.client.update({ where: { id }, data: { archivedAt: new Date(), version: { increment: 1 } } })
      await staffAudit(transaction, response, 'client', id, 'CLIENT_ARCHIVED')
      return archived
    })
    response.json({ data })
  })
  return routes
}
