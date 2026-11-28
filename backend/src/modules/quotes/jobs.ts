import type { OutboxJob, PrismaClient } from '@prisma/client'
import { published } from '../agency/model.js'
import type { Config } from '../../config/env.js'
import { claimJob, maxAttempts, retryTime } from '../notifications/outbox.js'
import type { Mailer } from '../notifications/mail-jobs.js'
import { lockEligiblePartner } from '../partners/model.js'
import { effectiveStatus, lockLinkedRequest, snapshotSchema } from './model.js'
import { pdfDigest, privateDirectory, publishPdf, quotePdfEnabled, readPdf } from './files.js'
import { renderQuotePdf } from './pdf.js'
import { casablancaDate } from '../business-inputs.js'

async function failJob(db: PrismaClient, job: OutboxJob, code: string, retry: boolean) {
  const terminal = !retry || job.attemptCount >= maxAttempts
  const now = new Date()
  await db.$transaction(async transaction => {
    const changed = await transaction.outboxJob.updateMany({
      where: { id: job.id, state: 'RUNNING', leaseToken: job.leaseToken },
      data: {
        state: terminal ? 'FAILED' : 'PENDING', leaseToken: null, leaseUntil: null,
        finishedAt: terminal ? now : null, lastErrorCode: code,
        nextAttemptAt: terminal ? now : retryTime(job.attemptCount),
      },
    })
    if (!changed.count || !terminal || !job.documentId) return
    const document = await transaction.document.findUnique({ where: { id: job.documentId }, select: { quoteId: true } })
    if (job.kind === 'GENERATE_PDF') await transaction.document.updateMany({ where: { id: job.documentId, status: 'QUEUED' }, data: { status: 'FAILED' } })
    if (document?.quoteId) await transaction.auditEvent.create({ data: {
      action: job.kind === 'GENERATE_PDF' ? 'QUOTE_PDF_FAILED' : 'QUOTE_DELIVERY_FAILED',
      targetType: 'quote', targetId: document.quoteId, metadata: { code },
    } })
  })
}

export async function generateNextQuotePdf(db: PrismaClient, config: Config) {
  if (!quotePdfEnabled(config)) return false
  const claimed = await claimJob(db, ['GENERATE_PDF'], true)
  if (!claimed) return false
  const job = await db.outboxJob.findFirst({ where: claimed, include: { document: { include: {
    quote: { select: { id: true, issuedSnapshot: true } },
  } } } })
  if (!job) return true
  const doc = job.document
  const quote = doc?.quote
  const snapshot = snapshotSchema.safeParse(quote?.issuedSnapshot)
  if (!doc || !quote || doc.status !== 'QUEUED' || !snapshot.success) {
    await failJob(db, job, 'QUOTE_SNAPSHOT_UNAVAILABLE', false)
    return true
  }

  try {
    const folder = await privateDirectory(config)
    const key = doc.id + '.pdf'
    const stored = await publishPdf(folder, key, await renderQuotePdf(snapshot.data))
    const now = new Date()
    await db.$transaction(async transaction => {
      const changed = await transaction.outboxJob.updateMany({ where: { ...claimed, state: 'RUNNING' }, data: {
        state: 'SUCCEEDED', finishedAt: now, leaseToken: null, leaseUntil: null, lastErrorCode: null,
      } })
      if (!changed.count) return
      await transaction.document.update({ where: { id: doc.id }, data: {
        status: 'READY', storageKey: key, sizeBytes: BigInt(stored.length), sha256: pdfDigest(stored), readyAt: now,
      } })
      await transaction.auditEvent.createMany({ data: [
        { action: 'QUOTE_PDF_READY', targetType: 'quote', targetId: quote.id },
        { action: 'QUOTE_PDF_READY', targetType: 'document', targetId: doc.id },
      ] })
    })
  } catch {
    await failJob(db, job, 'QUOTE_PDF_RETRY', true)
  }
  return true
}

export async function deliverNextQuote(db: PrismaClient, config: Config, mailer: Mailer) {
  if (!quotePdfEnabled(config) || config.SMTP_MODE !== 'local') return false
  const claimed = await claimJob(db, ['QUOTE_DELIVERY'])
  if (!claimed) return false
  const job = await db.outboxJob.findFirst({ where: claimed, include: { document: { include: { quote: { include: {
    client: { select: { email: true, intakeProvisional: true, archivedAt: true } },
    request: { select: { status: true, clientId: true, productId: true } },
  } } } } } })
  if (!job) return true
  const doc = job.document
  const quote = doc?.quote
  const snapshot = snapshotSchema.safeParse(quote?.issuedSnapshot)
  if (!quote || effectiveStatus(quote.status, quote.validUntil) !== 'ISSUED' || doc?.kind !== 'QUOTE_PDF' || doc.status !== 'READY' ||
      !doc.storageKey || !doc.sha256 || !doc.sizeBytes || !snapshot.success || !quote.client.email || quote.client.email !== snapshot.data.email ||
      quote.client.archivedAt || quote.client.intakeProvisional ||
      (quote.request && (['CLOSED', 'ACCEPTED'].includes(quote.request.status) || quote.request.clientId !== quote.clientId || quote.request.productId !== quote.productId))) {
    await failJob(db, job, 'QUOTE_DELIVERY_INVALID', false)
    return true
  }
  if (!await db.$transaction(transaction => lockEligiblePartner(transaction, quote.partnerId, quote.productId))) {
    await failJob(db, job, 'QUOTE_PARTNER_UNAVAILABLE', false)
    return true
  }
  try {
    const bytes = await readPdf(await privateDirectory(config), doc.storageKey, { sha256: doc.sha256, sizeBytes: doc.sizeBytes })
    const wording = await published(db, 'EMAIL')
    const result = await mailer.sendMail({
      from: config.SMTP_FROM, to: { name: '', address: quote.client.email },
      subject: (snapshot.data.agency?.agencyName ?? 'Zahraoui Cover') + ' - Proposition de test ' + snapshot.data.reference,
      text: 'Document de développement. Cette proposition ne constitue pas une couverture ou un contrat.' + (wording ? '\n\n' + wording.body : ''),
      messageId: '<zc-quote-' + job.id + '@' + config.SMTP_FROM?.split('@')[1] + '>',
      attachments: [{ filename: snapshot.data.reference + '.pdf', content: bytes, contentType: 'application/pdf' }],
    })
    if (!result.accepted.length) throw new Error('Quote not accepted by SMTP')
  } catch {
    await failJob(db, job, 'QUOTE_SMTP_RETRY', true)
    return true
  }

  // A successful transport result is the only path that sets SENT and QUOTE_SENT.
  const now = new Date()
  await db.$transaction(async transaction => {
    const locked = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM quotes WHERE id = ${quote.id}::uuid FOR UPDATE`
    if (!locked.length) return
    const request = await lockLinkedRequest(transaction, quote.requestId)
    const changed = await transaction.outboxJob.updateMany({ where: { ...claimed, state: 'RUNNING' }, data: {
      state: 'SUCCEEDED', finishedAt: now, leaseToken: null, leaseUntil: null, lastErrorCode: null,
    } })
    if (!changed.count) return
    await transaction.quote.update({ where: { id: quote.id }, data: {
      status: 'SENT', sentAt: now, version: { increment: 1 },
    } })
    if (request && ['NEW', 'IN_REVIEW', 'DECLINED'].includes(request.status)) {
      await transaction.quoteRequest.update({ where: { id: request.id }, data: {
        status: 'QUOTE_SENT', closedAt: null, version: { increment: 1 },
      } })
    }
    if (request) await transaction.auditEvent.create({ data: {
      action: 'QUOTE_REQUEST_DELIVERED', targetType: 'quote_request', targetId: request.id, metadata: { quoteId: quote.id },
    } })
    await transaction.auditEvent.create({ data: { action: 'QUOTE_DELIVERED', targetType: 'quote', targetId: quote.id } })
  })
  return true
}

export async function maintainQuoteJobs(db: PrismaClient) {
  const now = new Date()
  const overdue = await db.outboxJob.findMany({
    where: { kind: { in: ['GENERATE_PDF', 'QUOTE_DELIVERY'] }, document: { kind: 'QUOTE_PDF', quoteVersion: { not: null } },
      state: 'RUNNING', attemptCount: { gte: maxAttempts }, leaseUntil: { lte: now } },
    take: 50,
  })
  for (const job of overdue) await failJob(db, job, 'QUOTE_JOB_EXHAUSTED', false)
  await db.$executeRaw`
    WITH expired AS (
      UPDATE quotes SET status='EXPIRED', version=version+1, updated_at=${now}
      WHERE status IN ('ISSUED','SENT') AND valid_until < ${casablancaDate()}::date AND NOT EXISTS (
        SELECT 1 FROM outbox_jobs j JOIN documents d ON d.id=j.document_id
        WHERE d.quote_id=quotes.id AND j.kind='QUOTE_DELIVERY' AND j.state IN ('PENDING','RUNNING')
      )
      RETURNING id
    )
    INSERT INTO audit_events (action, target_type, target_id)
    SELECT 'QUOTE_EXPIRED', 'quote', id FROM expired
  `
}
