import { Prisma } from '@prisma/client'
import type { Contract, PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { currentSession, requireCsrf, requireRole } from '../auth/session.js'
import { casablancaDate, pageBounds, pagination, parseQuery, productSlug, searchPrefix, toProductSlug, versionField } from '../business-inputs.js'
import { recordHistory, staffAudit, staleRecord } from '../staff-records.js'
import { quotePdfEnabled } from '../quotes/files.js'
import { attachPdf, limitUpload, pdfBody, uploadVersion } from '../documents/uploads.js'
import { createExternalPolicy, draftValues, externalPolicyInput, reference, validateLinks } from './external-policy.js'
import { snapshotSchema } from '../quotes/model.js'
import { addDays, contractConflict, contractFilter, contractRow, contractRowSelect, coverageStatus, dateOnly, lockContract, onDate, policyFields } from './model.js'
import { obsoleteReminders, scheduleReminders } from './reminders.js'

const conversion = z.strictObject({ ...policyFields, quoteId: z.uuid(), quoteVersion: versionField })
const edit = z.strictObject(policyFields).partial().extend({ version: versionField }).refine(body => Object.keys(body).length > 1)
const statusInput = z.strictObject({
  version: versionField, status: z.enum(['ACTIVE', 'CANCELLED']),
  confirmationReference: z.string().trim().min(3).max(160).optional(), confirmationOn: z.iso.date().optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
}).refine(input => input.status === 'ACTIVE' ? Boolean(input.confirmationReference && input.confirmationOn && !input.reason)
  : Boolean(input.reason && !input.confirmationReference && !input.confirmationOn))
const renewal = z.strictObject({ version: versionField, effectiveOn: z.iso.date(), expiresOn: z.iso.date() })
export const contractList = z.strictObject({
  ...pagination, clientId: z.uuid().optional(), quoteId: z.uuid().optional(), partnerId: z.uuid().optional(), productSlug: productSlug.optional(),
  status: contractFilter.optional(), expiresFrom: z.iso.date().optional(), expiresTo: z.iso.date().optional(),
  renewals: z.literal('true').optional(),
}).refine(input => !input.expiresFrom || !input.expiresTo || input.expiresFrom <= input.expiresTo)

function missing() {
  return new ApiError(404, 'NOT_FOUND', 'Contrat introuvable.')
}

async function lockVersion(db: Prisma.TransactionClient, id: string, version: number) {
  await lockContract(db, id)
  const contract = await db.contract.findUniqueOrThrow({ where: { id } })
  if (contract.version !== version) throw staleRecord()
  return contract
}

async function detail(db: Prisma.TransactionClient, id: string, config: Config) {
  const row = await db.contract.findUnique({ where: { id }, select: {
    ...contractRowSelect, coverage: true, internalNotes: true, activationSnapshot: true, sourceQuoteSnapshot: true,
    confirmationReference: true, confirmationOn: true, cancelledAt: true, cancellationReason: true,
    confirmer: { select: { displayName: true } },
    previous: { select: { id: true, reference: true, expiresOn: true } },
    documents: { where: { kind: 'CONTRACT_PDF', status: 'READY' }, orderBy: { revision: 'desc' }, take: 100,
      select: { id: true, revision: true, createdAt: true, mimeType: true } },
    outboxJobs: { where: { kind: 'RENEWAL_ALERT' }, orderBy: [{ reminderExpiresOn: 'desc' }, { reminderDays: 'desc' }], take: 60,
      select: { id: true, state: true, lastErrorCode: true, reminderExpiresOn: true, reminderDays: true, nextAttemptAt: true, finishedAt: true } },
  } })
  if (!row) throw missing()
  const history = await db.$queryRaw<{ id: string; reference: string; status: Contract['status']; activatedAt: Date | null }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, previous_id FROM contracts WHERE id=${id}::uuid
      UNION SELECT policy.id, policy.previous_id FROM contracts policy JOIN ancestors earlier ON policy.id=earlier.previous_id
    ), family AS (
      SELECT policy.id, policy.reference, policy.status, policy.previous_id, policy.activated_at, policy.created_at
      FROM contracts policy JOIN ancestors earlier ON earlier.id=policy.id WHERE earlier.previous_id IS NULL
      UNION
      SELECT policy.id, policy.reference, policy.status, policy.previous_id, policy.activated_at, policy.created_at
      FROM contracts policy JOIN family earlier ON policy.previous_id=earlier.id
    )
    SELECT id,reference,status,activated_at AS "activatedAt" FROM family ORDER BY created_at DESC,id LIMIT 100
  `
  return {
    ...contractRow(row), coverage: row.coverage, internalNotes: row.internalNotes,
    confirmationReference: row.confirmationReference, confirmationOn: row.confirmationOn && dateOnly(row.confirmationOn),
    confirmer: row.confirmer, cancelledAt: row.cancelledAt, cancellationReason: row.cancellationReason,
    activationSnapshot: row.activationSnapshot, sourceQuoteSnapshot: row.sourceQuoteSnapshot,
    previous: row.previous && { ...row.previous, expiresOn: dateOnly(row.previous.expiresOn) },
    documents: row.documents, renewalHistory: history, reminders: row.outboxJobs.map(job => ({
      id: job.id, days: job.reminderDays, expiresOn: job.reminderExpiresOn && dateOnly(job.reminderExpiresOn),
      status: job.lastErrorCode === 'RENEWAL_OBSOLETE' ? 'OBSOLETE' : job.state, nextAttemptAt: job.nextAttemptAt, finishedAt: job.finishedAt,
    })),
    uploadEnabled: quotePdfEnabled(config),
    reminderDeliveryEnabled: config.NODE_ENV !== 'production' && config.SMTP_MODE === 'local' && Boolean(config.RENEWAL_NOTIFY_EMAIL),
    activity: await recordHistory(db, 'contract', id),
  }
}

export function contractWhere(input: z.infer<typeof contractList>) {
  const today = onDate(casablancaDate())
  const byStatus: Record<z.infer<typeof contractFilter>, Prisma.ContractWhereInput> = {
    DRAFT: { status: 'DRAFT' }, CANCELLED: { status: 'CANCELLED' },
    EXPIRED: { OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', expiresOn: { lte: today } }] },
    ACTIVE: { status: 'ACTIVE', confirmationOn: { not: null }, effectiveOn: { lte: today }, expiresOn: { gt: today } },
    SCHEDULED: { status: 'ACTIVE', confirmationOn: { not: null }, effectiveOn: { gt: today }, expiresOn: { gt: today } },
    UNVERIFIED: { status: 'ACTIVE', confirmationOn: null, expiresOn: { gt: today } },
  }
  const search = input.q && searchPrefix(input.q)
  const where: Prisma.ContractWhereInput = {
    clientId: input.clientId, quoteId: input.quoteId, partnerId: input.partnerId,
    product: input.productSlug ? { slug: toProductSlug(input.productSlug) } : undefined,
    expiresOn: { gte: input.expiresFrom ? onDate(input.expiresFrom) : undefined, lte: input.expiresTo ? onDate(input.expiresTo) : undefined },
    AND: [
      input.status ? byStatus[input.status] : {},
      input.renewals ? {
        status: { in: ['ACTIVE', 'EXPIRED'] }, confirmationOn: { not: null },
        expiresOn: { lte: onDate(addDays(dateOnly(today), 30)) },
        successors: { none: { activatedAt: { not: null } } },
      } : {},
      search ? { OR: [
        { reference: { startsWith: search, mode: 'insensitive' } },
        { policyNumber: { startsWith: search, mode: 'insensitive' } },
        { client: { displayName: { startsWith: search, mode: 'insensitive' } } },
      ] } : {},
    ],
  }
  return where
}

export function contractRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  const admin = requireRole('ADMIN')

  routes.get('/', async (request, response) => {
    const input = parseQuery(contractList, request.query)
    const { page, limit, skip } = pageBounds(input)
    const where = contractWhere(input)
    const [rows, total] = await db.$transaction([
      db.contract.findMany({ where, skip, take: limit, select: contractRowSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      db.contract.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(contractRow), meta: { page, limit, total } })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await db.$transaction(async transaction => {
      const record = await detail(transaction, id, config)
      await staffAudit(transaction, response, 'contract', id, 'RECORD_VIEWED')
      return record
    })
    response.json({ data })
  })
  routes.post('/', requireCsrf, async (request, response) => {
    const input = jsonBody(request, conversion)
    try {
      const data = await db.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT id FROM quotes WHERE id=${input.quoteId}::uuid FOR SHARE`
        const quote = await transaction.quote.findUnique({ where: { id: input.quoteId }, include: { next: { select: { id: true } } } })
        if (!quote || quote.status !== 'ACCEPTED' || !quote.sentAt || !quote.decidedAt || quote.next ||
            !quote.validUntil || dateOnly(quote.validUntil) < casablancaDate()) throw contractConflict('Ce devis accepté ne peut pas être converti.')
        if (quote.version !== input.quoteVersion) throw staleRecord()
        const snapshot = snapshotSchema.safeParse(quote.issuedSnapshot)
        if (!snapshot.success || (config.NODE_ENV === 'production' && snapshot.data.development)) {
          throw contractConflict('Le devis source doit avoir un historique admissible.')
        }
        await validateLinks(transaction, quote, true)
        const record = await transaction.contract.create({ data: {
          ...draftValues(input), quoteId: quote.id, clientId: quote.clientId, productId: quote.productId, partnerId: quote.partnerId,
          premiumMad: input.premiumMad ?? quote.totalMad ?? quote.annualPremiumMad, coverage: input.coverage ?? snapshot.data.coverage,
          reference: reference(), createdBy: currentSession(response).user.id,
          sourceQuoteSnapshot: {
            id: quote.id, reference: quote.reference, version: quote.version, acceptedAt: quote.decidedAt.toISOString(),
            product: snapshot.data.product, carrier: snapshot.data.carrier, coverage: snapshot.data.coverage, limits: snapshot.data.limits,
            deductibles: snapshot.data.deductibles, conditions: snapshot.data.conditions, total: snapshot.data.total, currency: quote.currency,
            development: snapshot.data.development,
          },
        } })
        await staffAudit(transaction, response, 'contract', record.id, 'CONTRACT_CREATED_FROM_QUOTE')
        return detail(transaction, record.id, config)
      })
      response.status(201).json({ data })
    } catch (error) { uniqueConflict(error) }
  })
  routes.post('/external', requireCsrf, async (request, response) => {
    const input = jsonBody(request, externalPolicyInput)
    try {
      const data = await db.$transaction(async transaction => {
        const record = await createExternalPolicy(transaction, input, currentSession(response).user.id)
        await staffAudit(transaction, response, 'contract', record.id, 'CONTRACT_EXTERNAL_DRAFT_CREATED')
        return detail(transaction, record.id, config)
      })
      response.status(201).json({ data })
    } catch (error) { uniqueConflict(error) }
  })
  routes.patch('/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, ...changes } = jsonBody(request, edit)
    try {
      const data = await db.$transaction(async transaction => {
        const record = await lockVersion(transaction, id, version)
        if (record.status !== 'DRAFT') throw contractConflict('Seul un brouillon peut être modifié.')
        const values = draftValues(changes, record)
        if (record.previousId) {
          const previous = await transaction.contract.findUniqueOrThrow({ where: { id: record.previousId }, select: { expiresOn: true } })
          if (values.effectiveOn < previous.expiresOn) throw contractConflict('Le renouvellement commence à l’échéance précédente ou plus tard.')
        }
        await transaction.contract.update({ where: { id }, data: { ...values, version: { increment: 1 } } })
        await staffAudit(transaction, response, 'contract', id, 'CONTRACT_UPDATED', { fields: Object.keys(changes) })
        return detail(transaction, id, config)
      })
      response.json({ data })
    } catch (error) { uniqueConflict(error) }
  })
  routes.post('/:id/status', admin, requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const input = jsonBody(request, statusInput)
    const data = await db.$transaction(async transaction => {
      const row = await lockVersion(transaction, id, input.version)
      const now = new Date()
      const actor = currentSession(response).user.id
      if (input.status === 'ACTIVE') {
        if (row.status !== 'DRAFT' || !row.policyNumber || !row.coverage || !row.premiumMad || row.expiresOn <= onDate(casablancaDate(now)) ||
            !input.confirmationOn || !input.confirmationReference || input.confirmationOn > casablancaDate(now)) {
          throw contractConflict('Une référence de police, les garanties, la prime, une période valide et une confirmation vérifiée sont obligatoires.')
        }
        const provider = await validateLinks(transaction, row, true)
        if (row.previousId) {
          await lockContract(transaction, row.previousId)
          const previous = await transaction.contract.findUniqueOrThrow({ where: { id: row.previousId } })
          if (row.effectiveOn < previous.expiresOn) throw contractConflict('Le renouvellement chevauche le terme précédent.')
          await obsoleteReminders(transaction, row.previousId)
        }
        const snapshot = {
          policyNumber: row.policyNumber, clientId: row.clientId, partnerId: row.partnerId, productId: row.productId,
          effectiveOn: dateOnly(row.effectiveOn), expiresOn: dateOnly(row.expiresOn), premiumMad: row.premiumMad.toFixed(2), currency: row.currency,
          carrier: provider.name, coverage: row.coverage, confirmationReference: input.confirmationReference, confirmationOn: input.confirmationOn,
        }
        await transaction.contract.update({ where: { id }, data: {
          status: 'ACTIVE', activatedAt: now, confirmationOn: onDate(input.confirmationOn), confirmationReference: input.confirmationReference,
          confirmedBy: actor, activationSnapshot: snapshot, version: { increment: 1 },
        } })
        await scheduleReminders(transaction, row, config, now)
        await staffAudit(transaction, response, 'contract', id, 'CONTRACT_CONFIRMED')
      } else {
        if (!['DRAFT', 'ACTIVE', 'SCHEDULED', 'UNVERIFIED'].includes(coverageStatus(row))) throw contractConflict('Ce contrat ne peut pas être annulé.')
        await obsoleteReminders(transaction, id)
        await transaction.contract.update({ where: { id }, data: {
          status: 'CANCELLED', cancelledAt: now, cancellationReason: input.reason, version: { increment: 1 },
        } })
        await staffAudit(transaction, response, 'contract', id, 'CONTRACT_CANCELLED')
      }
      return detail(transaction, id, config)
    })
    response.status(input.status === 'ACTIVE' ? 202 : 200).json({ data })
  })
  routes.post('/:id/renew', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const input = jsonBody(request, renewal)
    try {
      const data = await db.$transaction(async transaction => {
        const row = await lockVersion(transaction, id, input.version)
        const successor = await transaction.contract.findFirst({ where: { previousId: id, OR: [{ status: { not: 'CANCELLED' } }, { activatedAt: { not: null } }] } })
        if (!row.confirmationOn || !['ACTIVE', 'EXPIRED'].includes(coverageStatus(row)) || successor) throw contractConflict('Ce contrat n’est pas admissible au renouvellement.')
        await validateLinks(transaction, row)
        const dates = draftValues(input)
        if (dates.effectiveOn < row.expiresOn) throw contractConflict('Le renouvellement débute à l’échéance précédente ou plus tard.')
        const next = await transaction.contract.create({ data: {
          ...dates, reference: reference(), previousId: id, clientId: row.clientId, productId: row.productId, partnerId: row.partnerId,
          premiumMad: row.premiumMad, coverage: row.coverage, renewalReminders: row.renewalReminders, createdBy: currentSession(response).user.id,
        } })
        await staffAudit(transaction, response, 'contract', id, 'CONTRACT_RENEWAL_PREPARED', { successorId: next.id })
        await staffAudit(transaction, response, 'contract', next.id, 'CONTRACT_RENEWAL_CREATED', { previousId: id })
        return detail(transaction, next.id, config)
      })
      response.status(201).json({ data })
    } catch (error) { uniqueConflict(error) }
  })
  routes.post('/:id/documents', requireCsrf, limitUpload(db, config), pdfBody, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = parseQuery(z.strictObject({ version: uploadVersion }), request.query)
    const result = await attachPdf(db, config, request, response, { contractId: id, version, kind: 'CONTRACT_PDF' },
      transaction => detail(transaction, id, config))
    response.status(201).json({ data: result })
  })
  return routes
}

function uniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw contractConflict('Un contrat existe déjà pour ce devis, cette référence de police ou ce renouvellement.')
  }
  throw error
}
