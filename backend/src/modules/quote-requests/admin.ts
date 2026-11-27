import { Prisma } from '@prisma/client'
import type { PrismaClient, RequestStatus } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { currentSession, requireCsrf } from '../auth/session.js'
import { fromProductSlug, pagination, parseQuery, productSlug, profile, searchPrefix, toProductSlug, versionField } from '../business-inputs.js'
import { normalizePhone } from './intake.js'

const statusValues = z.enum(['NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'CLOSED'])
const transitions: Record<RequestStatus, RequestStatus[]> = {
  NEW: ['IN_REVIEW', 'CLOSED'], IN_REVIEW: ['CLOSED'],
  QUOTE_SENT: ['ACCEPTED', 'DECLINED', 'CLOSED'], ACCEPTED: [], DECLINED: [], CLOSED: [],
}
const terminal = new Set<RequestStatus>(['ACCEPTED', 'DECLINED', 'CLOSED'])
const listQuery = z.strictObject({
  ...pagination, status: statusValues.optional(), productSlug: productSlug.optional(),
  assignedTo: z.uuid().optional(), from: z.iso.date().optional(), to: z.iso.date().optional(),
}).refine(value => !value.from || !value.to || value.from <= value.to)
const patch = z.strictObject({
  version: versionField, status: statusValues.optional(), assignedTo: z.uuid().nullable().optional(), clientId: z.uuid().nullable().optional(),
}).refine(value => value.status !== undefined || value.assignedTo !== undefined || value.clientId !== undefined)
const note = z.strictObject({ version: versionField, body: z.string().trim().min(1).max(1000) })
const clientSelect = {
  id: true, profile: true, displayName: true, phone: true, email: true, city: true, version: true,
  intakeProvisional: true, archivedAt: true,
} satisfies Prisma.ClientSelect

export const requestRowSelect = {
  id: true, reference: true, firstName: true, lastName: true, phone: true, status: true, assignedTo: true,
  version: true, createdAt: true, product: { select: { slug: true } },
} satisfies Prisma.QuoteRequestSelect

export function requestRow(row: Prisma.QuoteRequestGetPayload<{ select: typeof requestRowSelect }>) {
  return {
    id: row.id, reference: row.reference, displayName: `${row.firstName} ${row.lastName}`, phone: row.phone,
    productSlug: fromProductSlug(row.product.slug), status: row.status, assignedTo: row.assignedTo ?? undefined,
    createdAt: row.createdAt, version: row.version,
  }
}

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'Demande introuvable.')
}

async function detail(database: Prisma.TransactionClient, id: string) {
  const row = await database.quoteRequest.findUnique({
    where: { id },
    include: {
      product: { select: { slug: true, title: true } },
      client: { select: clientSelect },
      assignee: { select: { id: true, displayName: true } },
      notes: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { author: { select: { displayName: true } } },
      },
    },
  })
  if (!row) throw notFound()
  return {
    ...requestRow(row), productTitle: row.product.title, profile: row.profile, firstName: row.firstName, lastName: row.lastName,
    email: row.email, city: row.city, preferredContact: row.preferredContact, situation: row.situation,
    desiredStartOn: row.desiredStartOn?.toISOString().slice(0, 10), needs: row.needs,
    noticeVersion: row.noticeVersion, acknowledgedAt: row.acknowledgedAt, updatedAt: row.updatedAt,
    clientId: row.clientId ?? undefined, client: row.client, assignee: row.assignee,
    allowedStatuses: transitions[row.status],
    notes: row.notes.map(entry => ({ id: entry.id, body: entry.body, authorName: entry.author?.displayName ?? '—', createdAt: entry.createdAt })),
  }
}

function pageBounds(query: { page?: number; limit?: number }) {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  return { page, limit, skip: (page - 1) * limit }
}

export function quoteAdminRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (request, response) => {
    const input = parseQuery(listQuery, request.query)
    const { page, limit, skip } = pageBounds(input)
    const where: Prisma.QuoteRequestWhereInput = {
      status: input.status, assignedTo: input.assignedTo,
      ...(input.productSlug ? { product: { slug: toProductSlug(input.productSlug) } } : {}),
      ...(input.q ? { AND: input.q.split(/\s+/).map(term => {
        const prefix = searchPrefix(term)
        return { OR: [
          { firstName: { startsWith: prefix, mode: 'insensitive' as const } },
          { lastName: { startsWith: prefix, mode: 'insensitive' as const } },
          { reference: { startsWith: prefix, mode: 'insensitive' as const } },
          { phone: { startsWith: normalizePhone(term) ?? prefix } },
          ...(normalizePhone(input.q!) ? [{ phone: normalizePhone(input.q!) }] : []),
        ] }
      }) } : {}),
    }
    if (input.from || input.to) {
      // PostgreSQL resolves local date boundaries correctly across Casablanca offset changes.
      const [range] = await database.$queryRaw<{ start: Date | null; ending: Date | null }[]>`
        SELECT (${input.from ?? null}::date::timestamp AT TIME ZONE 'Africa/Casablanca') AS start,
          ((${input.to ?? null}::date + 1)::timestamp AT TIME ZONE 'Africa/Casablanca') AS ending
      `
      where.createdAt = { gte: range.start ?? undefined, lt: range.ending ?? undefined }
    }
    const [rows, total] = await database.$transaction([
      database.quoteRequest.findMany({ where, skip, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: requestRowSelect }),
      database.quoteRequest.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(requestRow), meta: { page, limit, total } })
  })

  routes.get('/:id', async (request, response) => {
    response.json({ data: await detail(database, parseQuery(z.uuid(), request.params.id)) })
  })

  routes.patch('/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const input = jsonBody(request, patch)
    const data = await database.$transaction(async transaction => {
      const current = await transaction.quoteRequest.findUnique({ where: { id }, select: { status: true, version: true, clientId: true } })
      if (!current) throw notFound()
      if (current.version !== input.version) throw stale()
      if (input.status && input.status !== current.status && !transitions[current.status].includes(input.status)) {
        throw new ApiError(409, 'INVALID_TRANSITION', 'Ce changement de statut est indisponible.')
      }
      if (input.clientId === null) throw new ApiError(422, 'CLIENT_REQUIRED', 'Sélectionnez un client pour conserver le lien du dossier.')
      if (input.clientId) {
        const active = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM clients WHERE id = ${input.clientId}::uuid AND archived_at IS NULL FOR SHARE
        `
        if (!active.length) throw new ApiError(422, 'VALIDATION_FAILED', 'Client indisponible.', { clientId: 'Client indisponible.' })
      }
      if (input.assignedTo) {
        const active = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM staff_users WHERE id = ${input.assignedTo}::uuid AND is_active AND password_hash IS NOT NULL FOR SHARE
        `
        if (!active.length) throw new ApiError(422, 'VALIDATION_FAILED', 'Conseiller indisponible.', { assignedTo: 'Conseiller indisponible.' })
      }
      const write = await transaction.quoteRequest.updateMany({
        where: { id, version: input.version },
        data: {
          status: input.status, assignedTo: input.assignedTo, clientId: input.clientId, version: { increment: 1 },
          closedAt: input.status && input.status !== current.status && terminal.has(input.status) ? new Date() : undefined,
        },
      })
      if (!write.count) throw stale()
      await transaction.auditEvent.create({ data: {
        action: 'QUOTE_REQUEST_UPDATED', requestId: response.locals.requestId, actorId: currentSession(response).user.id,
        targetType: 'quote_request', targetId: id,
        metadata: { fields: Object.keys(input).filter(key => key !== 'version'), previousStatus: current.status, status: input.status ?? current.status },
      } })
      return detail(transaction, id)
    })
    response.json({ data })
  })

  routes.post('/:id/notes', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const input = jsonBody(request, note)
    const actorId = currentSession(response).user.id
    const data = await database.$transaction(async transaction => {
      const write = await transaction.quoteRequest.updateMany({ where: { id, version: input.version }, data: { version: { increment: 1 } } })
      if (!write.count) {
        if (!await transaction.quoteRequest.findUnique({ where: { id }, select: { id: true } })) throw notFound()
        throw stale()
      }
      await transaction.requestNote.create({ data: { requestId: id, authorId: actorId, body: input.body } })
      await transaction.auditEvent.create({ data: {
        action: 'QUOTE_REQUEST_NOTE_ADDED', requestId: response.locals.requestId,
        actorId, targetType: 'quote_request', targetId: id,
      } })
      return detail(transaction, id)
    })
    response.status(201).json({ data })
  })
  return routes
}

function stale() {
  return new ApiError(409, 'STALE_VERSION', 'Le dossier a été modifié. Rechargez la fiche.')
}

export function quoteSelectors(database: PrismaClient) {
  const routes = Router()
  routes.get('/staff-options', async (request, response) => {
    const input = parseQuery(z.strictObject(pagination), request.query)
    const { page, limit, skip } = pageBounds(input)
    const where: Prisma.StaffUserWhereInput = {
      isActive: true, passwordHash: { not: null }, displayName: input.q ? { startsWith: searchPrefix(input.q), mode: 'insensitive' } : undefined,
    }
    const [data, total] = await database.$transaction([
      database.staffUser.findMany({ where, skip, take: limit, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], select: { id: true, displayName: true } }),
      database.staffUser.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data, meta: { page, limit, total } })
  })
  routes.get('/clients', async (request, response) => {
    const input = parseQuery(z.strictObject({ ...pagination, profile: profile.optional(), archived: z.enum(['true','false']).optional() }), request.query)
    const { page, limit, skip } = pageBounds(input)
    const prefix = input.q ? searchPrefix(input.q) : undefined
    const where: Prisma.ClientWhereInput = {
      archivedAt: input.archived === 'true' ? { not: null } : null, profile: input.profile,
      OR: prefix ? [
        { displayName: { startsWith: prefix, mode: 'insensitive' } },
        { city: { startsWith: prefix, mode: 'insensitive' } },
        { phone: { startsWith: normalizePhone(input.q ?? '') ?? prefix } },
      ] : undefined,
    }
    const listFields = { ...clientSelect, email: false } as const
    const [rows, total] = await database.$transaction([
      database.client.findMany({ where, skip, take: limit, orderBy: [{ intakeProvisional: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }], select: listFields }),
      database.client.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows, meta: { page, limit, total } })
  })
  return routes
}
