import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { PrismaClient, Quote } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { currentSession, requireCsrf, requireRole } from '../auth/session.js'
import { casablancaDate, pageBounds, pagination, parseQuery, productSlug, searchPrefix, toProductSlug, versionField } from '../business-inputs.js'
import { dateRange, lockActiveClient, staffAudit, staleRecord } from '../staff-records.js'
import { agencySettings, publicCompany, published } from '../agency/model.js'
import { eligiblePartner, lockEligiblePartner } from '../partners/model.js'
import { privateDirectory, quotePdfEnabled } from './files.js'
import { calculateTotal, decisionMethod, deliveryJobKey, effectiveStatus, lockLinkedRequest, pdfJobKey, quoteInput, quoteRow, quoteRowSelect, quoteStatus, snapshotSchema } from './model.js'
import type { QuoteSnapshot } from './model.js'

const mutation = z.strictObject({ version: versionField })
const edit = quoteInput.partial().extend({ version: versionField }).refine(body => Object.keys(body).length > 1)
const decision = mutation.extend({
  status: z.enum(['ACCEPTED', 'DECLINED']), method: decisionMethod, evidence: z.string().trim().min(3).max(1000),
})
export const issuedQuoteList = z.strictObject({
  ...pagination, status: quoteStatus.optional(), productSlug: productSlug.optional(),
  clientId: z.uuid().optional(), requestId: z.uuid().optional(), from: z.iso.date().optional(), to: z.iso.date().optional(),
}).refine(({ from, to }) => !from || !to || from <= to)
const zero = new Prisma.Decimal(0)

function missing() {
  return new ApiError(404, 'NOT_FOUND', 'Devis introuvable.')
}
function invalid(message: string) {
  return new ApiError(409, 'QUOTE_STATE', message)
}

async function validateLinks(db: Prisma.TransactionClient, quote: Pick<Quote, 'requestId' | 'clientId' | 'productId' | 'partnerId'>) {
  const request = await lockLinkedRequest(db, quote.requestId)
  if (quote.requestId && (!request || request.clientId !== quote.clientId || request.productId !== quote.productId ||
      request.status === 'CLOSED' || request.status === 'ACCEPTED')) {
    throw invalid('La demande doit être ouverte et correspondre au client et à l’assurance.')
  }
  await lockActiveClient(db, quote.clientId)
  const partner = await lockEligiblePartner(db, quote.partnerId, quote.productId)
  if (!partner) throw invalid('Sélectionnez une compagnie vérifiée et active pour cette assurance.')
  return partner
}

async function draftFields(db: Prisma.TransactionClient, input: Partial<z.infer<typeof quoteInput>>, prior?: Quote) {
  const product = input.productSlug
    ? await db.insuranceProduct.findUnique({ where: { slug: toProductSlug(input.productSlug) }, select: { id: true } })
    : prior ? { id: prior.productId } : null
  if (!product) throw invalid('Assurance introuvable.')
  const clientId = input.clientId ?? prior?.clientId
  const partnerId = input.partnerId ?? prior?.partnerId
  const requestId = input.requestId === undefined ? prior?.requestId ?? null : input.requestId
  const annualPremiumMad = input.annualPremiumMad ?? prior?.annualPremiumMad
  if (!clientId || !partnerId || !annualPremiumMad) throw invalid('Client, compagnie et prime sont obligatoires.')
  const productId = product.id
  await validateLinks(db, { clientId, requestId, productId, partnerId })
  const feesMad = input.feesMad ?? prior?.feesMad ?? zero
  const taxesMad = input.taxesMad ?? prior?.taxesMad ?? zero
  if (input.validUntil && input.validUntil < casablancaDate()) throw new ApiError(422, 'QUOTE_DATE', 'Choisissez une date de validité actuelle ou future.', { validUntil: 'Date passée.' })
  return {
    clientId, requestId, productId, partnerId, annualPremiumMad, feesMad, taxesMad, totalMad: calculateTotal(annualPremiumMad, feesMad, taxesMad),
    coverage: input.coverage, coverageLimits: input.coverageLimits, deductibles: input.deductibles,
    conditions: input.conditions, customerNotes: input.customerNotes, internalNotes: input.internalNotes,
    validUntil: input.validUntil === undefined ? undefined : input.validUntil ? new Date(input.validUntil + 'T00:00:00.000Z') : null,
  }
}

async function lockedQuote(db: Prisma.TransactionClient, id: string, version: number) {
  const [lock] = await db.$queryRaw<{ id: string }[]>`SELECT id FROM quotes WHERE id = ${id}::uuid FOR UPDATE`
  if (!lock) throw missing()
  const row = await db.quote.findUniqueOrThrow({ where: { id }, include: {
    client: { select: { displayName: true, city: true, email: true, archivedAt: true, intakeProvisional: true } },
    product: { select: { title: true } }, next: { select: { id: true } },
    documents: { where: { kind: 'QUOTE_PDF' }, orderBy: { revision: 'desc' }, take: 1 },
  } })
  if (row.version !== version) throw staleRecord()
  return row
}

function reference() {
  return 'DV-' + randomBytes(12).toString('hex').toUpperCase()
}

async function detail(db: Prisma.TransactionClient, id: string, config: Config) {
  const row = await db.quote.findUnique({ where: { id }, select: {
    ...quoteRowSelect, previousId: true, coverage: true, coverageLimits: true, deductibles: true, conditions: true,
    internalNotes: true, customerNotes: true, feesMad: true, taxesMad: true, decidedAt: true, decisionMethod: true,
    decisionEvidence: true, decisionActor: { select: { displayName: true } },
    client: { select: { displayName: true, email: true, archivedAt: true, intakeProvisional: true } },
    request: { select: { reference: true } },
    next: { select: { id: true } },
    documents: { where: { kind: 'QUOTE_PDF' }, orderBy: { revision: 'desc' }, select: {
      id: true, status: true, revision: true, quoteVersion: true, createdAt: true, mimeType: true,
      outboxJobs: { where: { kind: 'QUOTE_DELIVERY' }, select: { state: true } },
    } },
  } })
  if (!row) throw missing()
  const revisions = await db.$queryRaw<{ id: string; reference: string; revision: number; status: Quote['status']; validUntil: Date | null }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, previous_id FROM quotes WHERE id = ${id}::uuid
      UNION
      SELECT q.id, q.previous_id FROM quotes q JOIN ancestors a ON q.id = a.previous_id
    ), family AS (
      SELECT q.id, q.reference, q.revision, q.status, q.valid_until FROM quotes q JOIN ancestors a ON a.id=q.id WHERE a.previous_id IS NULL
      UNION
      SELECT q.id, q.reference, q.revision, q.status, q.valid_until FROM quotes q JOIN family f ON q.previous_id=f.id
    )
    SELECT id, reference, revision, status, valid_until AS "validUntil" FROM family ORDER BY revision DESC
  `
  const documents = row.documents.map(({ outboxJobs, ...document }) => ({
    ...document, delivery: outboxJobs[0]?.state ?? null,
  }))
  return {
    ...quoteRow(row), coverage: row.coverage, coverageLimits: row.coverageLimits, deductibles: row.deductibles, conditions: row.conditions,
    customerNotes: row.customerNotes, internalNotes: row.internalNotes, feesMad: row.feesMad.toFixed(2), taxesMad: row.taxesMad.toFixed(2),
    client: row.client, requestReference: row.request?.reference ?? null,
    decidedAt: row.decidedAt, decisionMethod: row.decisionMethod, decisionEvidence: row.decisionEvidence, decisionActor: row.decisionActor,
    revisions: revisions.map(({ validUntil, ...revision }) => ({ ...revision, status: effectiveStatus(revision.status, validUntil) })),
    hasNext: Boolean(row.next), pdfEnabled: quotePdfEnabled(config), deliveryEnabled: quotePdfEnabled(config) && config.SMTP_MODE === 'local',
    documents,
  }
}

async function jobBusy(db: Prisma.TransactionClient, id: string) {
  return Boolean(await db.outboxJob.count({ where: {
    document: { quoteId: id }, kind: 'QUOTE_DELIVERY', state: { in: ['PENDING', 'RUNNING'] },
  } }))
}

export async function issuedQuoteWhere(db: Prisma.TransactionClient, input: z.infer<typeof issuedQuoteList>) {
  const search = input.q && searchPrefix(input.q)
  const today = new Date(casablancaDate() + 'T00:00:00Z')
  const statusFilter: Prisma.QuoteWhereInput = input.status === 'EXPIRED'
    ? { OR: [{ status: 'EXPIRED' }, { status: { in: ['ISSUED', 'SENT'] }, validUntil: { lt: today } }] }
    : input.status === 'ISSUED' || input.status === 'SENT'
      ? { status: input.status, OR: [{ validUntil: null }, { validUntil: { gte: today } }] }
      : { status: input.status }
  const where: Prisma.QuoteWhereInput = {
    clientId: input.clientId, requestId: input.requestId,
    product: input.productSlug ? { slug: toProductSlug(input.productSlug) } : undefined,
    createdAt: await dateRange(db, input.from, input.to),
    AND: [statusFilter, ...(search ? [{ OR: [
      { reference: { startsWith: search, mode: 'insensitive' as const } },
      { client: { displayName: { startsWith: search, mode: 'insensitive' as const } } },
    ] }] : [])],
  }
  return where
}

export function issuedQuoteRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  const admin = requireRole('ADMIN')
  routes.get('/', async (request, response) => {
    const input = parseQuery(issuedQuoteList, request.query)
    const { page, limit, skip } = pageBounds(input)
    const where = await issuedQuoteWhere(db, input)
    const [rows, total] = await db.$transaction([
      db.quote.findMany({ where, skip, take: limit, select: quoteRowSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      db.quote.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(quoteRow), meta: { page, limit, total } })
  })
  routes.get('/partner-options', async (request, response) => {
    const { productSlug: category } = parseQuery(z.strictObject({ productSlug: productSlug.optional() }), request.query)
    const data = await db.partner.findMany({
      where: { ...eligiblePartner, categories: category ? { has: toProductSlug(category) } : undefined }, take: 100,
      orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, displayName: true },
    })
    response.json({ data: data.map(row => ({ id: row.id, name: row.displayName ?? row.name })) })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await db.$transaction(async transaction => {
      const data = await detail(transaction, id, config)
      await staffAudit(transaction, response, 'quote', id, 'RECORD_VIEWED')
      return data
    })
    response.json({ data })
  })
  routes.post('/', requireCsrf, async (request, response) => {
    const input = jsonBody(request, quoteInput)
    const actor = currentSession(response).user.id
    const data = await db.$transaction(async transaction => {
      const values = await draftFields(transaction, input)
      const row = await transaction.quote.create({ data: { ...values, reference: reference(), createdBy: actor } })
      await staffAudit(transaction, response, 'quote', row.id, 'QUOTE_CREATED')
      return detail(transaction, row.id, config)
    })
    response.status(201).json({ data })
  })
  routes.patch('/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, ...input } = jsonBody(request, edit)
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      if (row.status !== 'DRAFT') throw invalid('Seul un brouillon peut être modifié.')
      const values = await draftFields(transaction, input, row)
      if (row.previousId && (values.clientId !== row.clientId || values.requestId !== row.requestId || values.productId !== row.productId)) {
        throw invalid('Une révision conserve la demande, le client et la catégorie.')
      }
      await transaction.quote.update({ where: { id }, data: { ...values, version: { increment: 1 } } })
      await staffAudit(transaction, response, 'quote', id, 'QUOTE_UPDATED', { fields: Object.keys(input) })
      return detail(transaction, id, config)
    })
    response.json({ data })
  })
  routes.post('/:id/issue', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, mutation)
    await privateDirectory(config)
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      const today = casablancaDate()
      const validUntil = row.validUntil?.toISOString().slice(0, 10)
      if (row.status !== 'DRAFT' || !validUntil || validUntil < today || !row.coverage || !row.coverageLimits || !row.conditions || !row.totalMad) {
        throw invalid('Complétez les garanties, les limites, les conditions, le prix et la date de validité du brouillon.')
      }
      const partner = await validateLinks(transaction, row)
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock_shared(381972, 3)`
      const { agencyName, officePhone, assistancePhone, legalName, email, address, city, registration, authorization } = publicCompany(await agencySettings(transaction))
      const wording = await published(transaction, 'QUOTE')
      const snapshot: QuoteSnapshot = {
        agency: { agencyName, officePhone, assistancePhone, legalName, email, address, city, registration, authorization },
        ...(wording ? { quoteWording: { id: wording.id, body: wording.body } } : {}),
        reference: row.reference, revision: row.revision, issuedOn: today, validUntil, clientName: row.client.displayName, city: row.client.city,
        email: row.client.email, product: row.product.title, carrier: partner.name,
        coverage: row.coverage, limits: row.coverageLimits, deductibles: row.deductibles, conditions: row.conditions, customerNotes: row.customerNotes,
        premium: row.annualPremiumMad.toFixed(2), fees: row.feesMad.toFixed(2), taxes: row.taxesMad.toFixed(2), total: row.totalMad.toFixed(2), development: true,
      }
      await transaction.quote.update({ where: { id }, data: { status: 'ISSUED', issuedAt: new Date(), issuedSnapshot: snapshot, version: { increment: 1 } } })
      const document = await transaction.document.create({ data: { quoteId: id, quoteVersion: version + 1, kind: 'QUOTE_PDF', revision: row.revision, mimeType: 'application/pdf' } })
      await transaction.outboxJob.create({ data: { kind: 'GENERATE_PDF', documentId: document.id, dedupeKey: pdfJobKey(document.id), nextAttemptAt: new Date() } })
      await staffAudit(transaction, response, 'quote', id, 'QUOTE_ISSUED')
      return detail(transaction, id, config)
    })
    response.status(202).json({ data })
  })
  routes.post('/:id/retry-pdf', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, mutation)
    await privateDirectory(config)
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      const document = row.documents[0]
      if (effectiveStatus(row.status, row.validUntil) !== 'ISSUED' || document?.status !== 'FAILED') throw invalid('Ce PDF ne peut pas être remis en file.')
      const updated = await transaction.outboxJob.updateMany({
        where: { dedupeKey: pdfJobKey(document.id), state: 'FAILED' },
        data: { state: 'PENDING', attemptCount: 0, finishedAt: null, lastErrorCode: null, nextAttemptAt: new Date() },
      })
      if (!updated.count) throw invalid('La génération est déjà en cours.')
      await transaction.document.update({ where: { id: document.id }, data: { status: 'QUEUED' } })
      await transaction.quote.update({ where: { id }, data: { version: { increment: 1 } } })
      await staffAudit(transaction, response, 'quote', id, 'QUOTE_PDF_REQUEUED')
      return detail(transaction, id, config)
    })
    response.status(202).json({ data })
  })
  routes.post('/:id/send', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, mutation)
    await privateDirectory(config)
    if (config.SMTP_MODE !== 'local') throw new ApiError(503, 'QUOTE_DELIVERY_DISABLED', 'L’envoi de devis est disponible uniquement avec le SMTP de test.')
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      const document = row.documents[0]
      if (effectiveStatus(row.status, row.validUntil) !== 'ISSUED' || document?.status !== 'READY') throw invalid('Le devis doit être émis, valide et avoir un PDF prêt.')
      await validateLinks(transaction, row)
      const current = await transaction.client.findUniqueOrThrow({ where: { id: row.clientId }, select: { email: true, intakeProvisional: true } })
      const snapshot = snapshotSchema.safeParse(row.issuedSnapshot)
      if (current.intakeProvisional || !current.email || !snapshot.success || snapshot.data.email !== current.email) {
        throw invalid('Vérifiez la fiche et l’adresse email du client. Toute modification de l’adresse après émission nécessite une révision.')
      }
      const dedupeKey = deliveryJobKey(document.id)
      const prior = await transaction.outboxJob.findUnique({ where: { dedupeKey } })
      if (prior && prior.state !== 'FAILED') return detail(transaction, id, config)
      if (prior) await transaction.outboxJob.update({
        where: { id: prior.id }, data: { state: 'PENDING', attemptCount: 0, finishedAt: null, lastErrorCode: null, nextAttemptAt: new Date() },
      })
      else await transaction.outboxJob.create({ data: { kind: 'QUOTE_DELIVERY', documentId: document.id, dedupeKey, nextAttemptAt: new Date() } })
      await transaction.quote.update({ where: { id }, data: { version: { increment: 1 } } })
      await staffAudit(transaction, response, 'quote', id, 'QUOTE_DELIVERY_QUEUED')
      return detail(transaction, id, config)
    })
    response.status(202).json({ data })
  })
  routes.post('/:id/decision', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, status, method, evidence } = jsonBody(request, decision)
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      if (effectiveStatus(row.status, row.validUntil) !== 'SENT' || !row.sentAt || row.next) throw invalid('La décision concerne uniquement un devis envoyé, valide et en vigueur.')
      const related = await lockLinkedRequest(transaction, row.requestId)
      if (related && (related.status !== 'QUOTE_SENT' || await transaction.outboxJob.count({
        where: { kind: 'QUOTE_DELIVERY', state: { in: ['PENDING', 'RUNNING'] }, document: { quote: { requestId: related.id } } },
      }))) throw invalid('La demande liée ne permet pas cette décision pendant un envoi ou après clôture.')
      const actor = currentSession(response).user.id
      const now = new Date()
      await transaction.quote.update({ where: { id }, data: {
        status, decidedAt: now, decidedBy: actor, decisionMethod: method, decisionEvidence: evidence, version: { increment: 1 },
      } })
      if (related) {
        const alternatives = status === 'DECLINED' && await transaction.quote.count({
          where: { requestId: related.id, id: { not: id }, status: { in: ['DRAFT', 'ISSUED', 'SENT'] },
            OR: [{ validUntil: null }, { validUntil: { gte: new Date(casablancaDate() + 'T00:00:00Z') } }] },
        })
        if (!alternatives) {
          await transaction.quoteRequest.update({ where: { id: related.id }, data: { status, closedAt: now, version: { increment: 1 } } })
          await staffAudit(transaction, response, 'quote_request', related.id, 'QUOTE_REQUEST_DECISION', { quoteId: id, status })
        }
      }
      await staffAudit(transaction, response, 'quote', id, 'QUOTE_DECISION_RECORDED', { status, method })
      return detail(transaction, id, config)
    })
    response.json({ data })
  })
  routes.post('/:id/cancel', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, mutation)
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      if (!['DRAFT', 'ISSUED', 'SENT'].includes(row.status) || await jobBusy(transaction, id)) throw invalid('Ce devis ne peut pas être annulé pendant l’envoi ou après une décision.')
      await transaction.quote.update({ where: { id }, data: { status: 'CANCELLED', version: { increment: 1 } } })
      await staffAudit(transaction, response, 'quote', id, 'QUOTE_CANCELLED')
      return detail(transaction, id, config)
    })
    response.json({ data })
  })
  routes.post('/:id/revision', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, mutation)
    const data = await db.$transaction(async transaction => {
      const row = await lockedQuote(transaction, id, version)
      if (!row.issuedAt || row.status === 'ACCEPTED' || row.next || row.revision >= 50 || await jobBusy(transaction, id)) throw invalid('Aucune nouvelle révision ne peut être créée pour ce devis.')
      await validateLinks(transaction, row)
      if (row.status === 'ISSUED' || row.status === 'SENT') {
        await transaction.quote.update({ where: { id }, data: { status: 'CANCELLED', version: { increment: 1 } } })
      }
      const next = await transaction.quote.create({ data: {
        reference: reference(), previousId: id, revision: row.revision + 1, clientId: row.clientId, requestId: row.requestId,
        productId: row.productId, partnerId: row.partnerId, annualPremiumMad: row.annualPremiumMad, feesMad: row.feesMad, taxesMad: row.taxesMad,
        totalMad: row.totalMad, coverage: row.coverage, coverageLimits: row.coverageLimits, deductibles: row.deductibles,
        conditions: row.conditions, customerNotes: row.customerNotes, internalNotes: row.internalNotes, createdBy: currentSession(response).user.id,
      } })
      await staffAudit(transaction, response, 'quote', next.id, 'QUOTE_REVISION_CREATED', { previousId: id })
      return detail(transaction, next.id, config)
    })
    response.status(201).json({ data })
  })
  return routes
}
