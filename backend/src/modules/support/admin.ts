import type { AssistanceStatus, MessageStatus, Prisma, PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { coverageStatus } from '../contracts/model.js'
import { currentSession, requireCsrf } from '../auth/session.js'
import { fromProductSlug, normalizePhone, noteBody, pageBounds, pagination, parseQuery, productSlug, searchPrefix, toProductSlug, versionField } from '../business-inputs.js'
import { dateRange, lockActiveClient, recordHistory, staffAudit, staleRecord } from '../staff-records.js'

const assistanceStatus = z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED'])
const priority = z.enum(['NORMAL', 'URGENT'])
const messageStatus = z.enum(['UNREAD', 'READ', 'PROCESSED'])
const dates = { from: z.iso.date().optional(), to: z.iso.date().optional() }
const dateOrder = ({ from, to }: { from?: string; to?: string }) => !from || !to || from <= to
const assistanceContractSelect = { id: true, reference: true, status: true, effectiveOn: true, expiresOn: true, confirmationOn: true } as const
const baseRow = { id: true, reference: true, fullName: true, createdAt: true, version: true } as const
const messageRow = { ...baseRow, status: true, subject: true, archivedAt: true } as const
const assistanceRow = { ...baseRow, status: true, priority: true, assignedTo: true, product: { select: { slug: true } } } as const
const recent = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
const transitions: Record<AssistanceStatus, AssistanceStatus[]> = { NEW: ['IN_PROGRESS', 'RESOLVED'], IN_PROGRESS: ['RESOLVED'], RESOLVED: [] }
const messageTransitions: Record<MessageStatus, MessageStatus[]> = { UNREAD: ['READ', 'PROCESSED'], READ: ['UNREAD', 'PROCESSED'], PROCESSED: [] }
const assistancePatch = z.strictObject({
  version: versionField, status: assistanceStatus.optional(), priority: priority.optional(),
  assignedTo: z.uuid().nullable().optional(), clientId: z.uuid().nullable().optional(), contractId: z.uuid().nullable().optional(),
}).refine(body => Object.keys(body).some(key => key !== 'version'))

function notFound() {
  return new ApiError(404, 'NOT_FOUND', 'Dossier introuvable.')
}

function invalidTransition() {
  return new ApiError(409, 'INVALID_TRANSITION', 'Ce changement de statut est indisponible.')
}

function caseRow({ product, ...fields }: Prisma.AssistanceCaseGetPayload<{ select: typeof assistanceRow }>) {
  return { ...fields, productSlug: fromProductSlug(product.slug) }
}

async function assistanceDetail(database: Prisma.TransactionClient, id: string) {
  const record = await database.assistanceCase.findUnique({
    where: { id }, include: {
      product: { select: { slug: true, title: true } },
      assignee: { select: { id: true, displayName: true } },
      client: { select: { id: true, displayName: true, intakeProvisional: true, archivedAt: true } },
      contract: { select: assistanceContractSelect },
      notes: { take: 50, orderBy: recent, select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } } },
    },
  })
  if (!record) throw notFound()
  const { product, productId, notes, contract, ...fields } = record
  void productId
  return {
    ...fields, contract: contract && { id: contract.id, reference: contract.reference, status: coverageStatus(contract) }, productSlug: fromProductSlug(product.slug), productTitle: product.title,
    allowedStatuses: transitions[fields.status],
    notes: notes.map(note => ({ id: note.id, body: note.body, createdAt: note.createdAt, authorName: note.author?.displayName ?? '—' })),
    activity: await recordHistory(database, 'assistance_case', id),
  }
}

export function assistanceAdminRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (request, response) => {
    const input = parseQuery(z.strictObject({
      ...pagination, ...dates, status: assistanceStatus.optional(), priority: priority.optional(),
      productSlug: productSlug.optional(), assignedTo: z.uuid().optional(), reference: z.string().max(32).optional(),
    }).refine(dateOrder), request.query)
    const { page, limit, skip } = pageBounds(input)
    const prefix = input.q && searchPrefix(input.q)
    const where: Prisma.AssistanceCaseWhereInput = {
      status: input.status, priority: input.priority, assignedTo: input.assignedTo, reference: input.reference,
      product: input.productSlug ? { slug: toProductSlug(input.productSlug) } : undefined,
      createdAt: await dateRange(database, input.from, input.to),
      OR: prefix ? [
        { reference: { startsWith: prefix, mode: 'insensitive' } },
        { fullName: { startsWith: prefix, mode: 'insensitive' } },
        { phone: { startsWith: normalizePhone(input.q ?? '') ?? prefix } },
      ] : undefined,
    }
    const [rows, total] = await database.$transaction([
      database.assistanceCase.findMany({ where, skip, take: limit, orderBy: recent, select: assistanceRow }),
      database.assistanceCase.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(caseRow), meta: { page, limit, total } })
  })
  routes.get('/:id/contract-options', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { clientId, q, ...bounds } = parseQuery(z.strictObject({ ...pagination, clientId: z.uuid() }), request.query)
    const { page, limit, skip } = pageBounds(bounds)
    const [data, total] = await database.$transaction(async transaction => {
      const record = await transaction.assistanceCase.findUnique({ where: { id }, select: { productId: true } })
      if (!record) throw notFound()
      const client = await lockActiveClient(transaction, clientId)
      if (client.provisional) return [[], 0] as const
      const where: Prisma.ContractWhereInput = {
        clientId, productId: record.productId, status: { in: ['ACTIVE', 'EXPIRED'] },
        reference: q ? { startsWith: searchPrefix(q), mode: 'insensitive' } : undefined,
      }
      const data = await transaction.contract.findMany({ where, take: limit, skip, orderBy: recent, select: assistanceContractSelect })
      return [data, await transaction.contract.count({ where })] as const
    }, { isolationLevel: 'RepeatableRead' })
    response.json({ data: data.map(record => ({ id: record.id, reference: record.reference, status: coverageStatus(record) })), meta: { page, limit, total } })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await database.$transaction(async transaction => {
      const record = await assistanceDetail(transaction, id)
      await staffAudit(transaction, response, 'assistance_case', id, 'RECORD_VIEWED')
      return record
    })
    response.json({ data })
  })
  routes.patch('/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, status, priority, assignedTo, clientId, contractId } = jsonBody(request, assistancePatch)
    const data = await database.$transaction(async transaction => {
      const current = await transaction.assistanceCase.findUnique({ where: { id } })
      if (!current) throw notFound()
      if (current.version !== version) throw staleRecord()
      if (status && status !== current.status && !transitions[current.status].includes(status)) throw invalidTransition()
      const nextClient = clientId === undefined ? current.clientId : clientId
      const nextContract = contractId === undefined ? current.contractId : contractId
      if ((clientId !== undefined || contractId !== undefined) && nextClient) {
        const client = await lockActiveClient(transaction, nextClient)
        if (client.provisional) throw new ApiError(422, 'CLIENT_UNVERIFIED', 'Vérifiez le client avant de le lier.')
      }
      if ((clientId !== undefined || contractId !== undefined) && nextContract) {
        const [contract] = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM contracts WHERE id = ${nextContract}::uuid AND client_id = ${nextClient}::uuid
            AND product_id = ${current.productId}::uuid AND status IN ('ACTIVE', 'EXPIRED') FOR SHARE
        `
        if (!contract) throw new ApiError(422, 'CONTRACT_MISMATCH', 'Le contrat doit correspondre au client et à l’assurance.')
      }
      if (assignedTo) {
        const [staff] = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM staff_users WHERE id = ${assignedTo}::uuid AND is_active AND password_hash IS NOT NULL FOR SHARE
        `
        if (!staff) throw new ApiError(422, 'ASSIGNEE_UNAVAILABLE', 'Conseiller indisponible.')
      }
      const updated = await transaction.assistanceCase.updateMany({
        where: { id, version },
        data: { status, priority, assignedTo, clientId, contractId, version: { increment: 1 }, closedAt: status === 'RESOLVED' && current.status !== status ? new Date() : undefined },
      })
      if (!updated.count) throw staleRecord()
      await staffAudit(transaction, response, 'assistance_case', id, 'ASSISTANCE_UPDATED', {
        status: status ?? current.status,
        fields: Object.entries({ status, priority, assignedTo, clientId, contractId }).filter(([, val]) => val !== undefined).map(([key]) => key),
        ...(nextClient !== current.clientId ? { previousClientId: current.clientId, clientId: nextClient } : {}),
        ...(nextContract !== current.contractId ? { previousContractId: current.contractId, contractId: nextContract } : {}),
      })
      return assistanceDetail(transaction, id)
    })
    response.json({ data })
  })
  routes.post('/:id/notes', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, body } = jsonBody(request, noteBody)
    const data = await database.$transaction(async transaction => {
      const updated = await transaction.assistanceCase.updateMany({ where: { id, version }, data: { version: { increment: 1 } } })
      if (!updated.count) {
        if (!await transaction.assistanceCase.count({ where: { id } })) throw notFound()
        throw staleRecord()
      }
      await transaction.requestNote.create({ data: { body, caseId: id, authorId: currentSession(response).user.id } })
      await staffAudit(transaction, response, 'assistance_case', id, 'ASSISTANCE_NOTE_ADDED')
      return assistanceDetail(transaction, id)
    })
    response.status(201).json({ data })
  })
  return routes
}

export function messageAdminRoutes(database: PrismaClient) {
  const routes = Router()
  routes.get('/', async (request, response) => {
    const input = parseQuery(z.strictObject({
      ...pagination, ...dates, status: messageStatus.optional(), reference: z.string().max(32).optional(),
      archived: z.enum(['true', 'false']).optional(),
    }).refine(dateOrder), request.query)
    const { page, limit, skip } = pageBounds(input)
    const prefix = input.q && searchPrefix(input.q)
    const where: Prisma.ContactMessageWhereInput = {
      status: input.status, reference: input.reference,
      archivedAt: input.archived === 'true' ? { not: null } : null,
      createdAt: await dateRange(database, input.from, input.to),
      OR: prefix ? [
        { reference: { startsWith: prefix, mode: 'insensitive' } },
        { fullName: { startsWith: prefix, mode: 'insensitive' } },
        { subject: { startsWith: prefix, mode: 'insensitive' } },
      ] : undefined,
    }
    const [data, total] = await database.$transaction([
      database.contactMessage.findMany({ where, skip, take: limit, orderBy: recent, select: messageRow }),
      database.contactMessage.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data, meta: { page, limit, total } })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const record = await database.$transaction(async transaction => {
      const message = await transaction.contactMessage.findUnique({ where: { id } })
      if (!message) throw notFound()
      await staffAudit(transaction, response, 'contact_message', id, 'RECORD_VIEWED')
      return message
    })
    response.json({ data: record })
  })

  const archiveBody = z.strictObject({ version: versionField })
  const statusBody = archiveBody.extend({ status: messageStatus })
  function update(archive: boolean) {
    return async (request: import('express').Request, response: import('express').Response) => {
      const id = parseQuery(z.uuid(), request.params.id)
      const input: { version: number; status?: MessageStatus } = archive ? jsonBody(request, archiveBody) : jsonBody(request, statusBody)
      const { status } = input
      const data = await database.$transaction(async transaction => {
        const current = await transaction.contactMessage.findUnique({ where: { id } })
        if (!current) throw notFound()
        if (current.version !== input.version) throw staleRecord()
        if (current.archivedAt || (archive && current.status !== 'PROCESSED') ||
            (status && status !== current.status && !messageTransitions[current.status].includes(status))) throw invalidTransition()
        const now = new Date()
        const result = await transaction.contactMessage.updateMany({
          where: { id, version: input.version }, data: {
            status, version: { increment: 1 }, archivedAt: archive ? now : undefined,
            processedAt: status === 'PROCESSED' && status !== current.status ? now : undefined,
          },
        })
        if (!result.count) throw staleRecord()
        await staffAudit(transaction, response, 'contact_message', id, archive ? 'CONTACT_ARCHIVED' : 'CONTACT_UPDATED', { status: status ?? current.status })
        return transaction.contactMessage.findUniqueOrThrow({ where: { id } })
      })
      response.json({ data })
    }
  }
  routes.patch('/:id', requireCsrf, update(false))
  routes.post('/:id/archive', requireCsrf, update(true))
  return routes
}
