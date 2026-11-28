import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { keyedDigest } from '../../utils/crypto.js'
import { agencySettings, intakeNotice, notificationPolicy } from '../agency/model.js'
import { emailField } from '../auth/contracts.js'
import { requireAttempt, takeAttempt } from '../auth/limits.js'
import { phoneField, productSlug } from '../business-inputs.js'

const fields = {
  fullName: z.string().trim().min(2).max(120),
  phone: phoneField,
  noticeVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,32}$/),
  acknowledged: z.literal(true),
}
const narrative = z.string().trim().min(10).max(1000)
const contactBody = z.strictObject({ ...fields, email: emailField, subject: z.string().trim().min(3).max(120), message: narrative })
const assistanceBody = z.strictObject({ ...fields, productSlug, contractReference: z.string().trim().min(1).max(64).optional(), description: narrative })

export function supportIntakeRoutes(database: PrismaClient, config: Config, action: 'CONTACT' | 'ASSISTANCE') {
  const routes = Router()
  const contact = action === 'CONTACT'
  const form = contact ? 'contact' : 'assistance'
  routes.get('/notice', async (_request, response) => {
    response.json({ data: await intakeNotice(database, config, form) })
  })

  routes.post('/', async (request, response) => {
    const source = request.ip ?? request.socket.remoteAddress ?? 'unknown'
    requireAttempt(response, await takeAttempt(database, config.RATE_KEY_SECRET, contact ? 'contact_source' : 'assistance_source', source, 10, 900_000))
    const input = contact ? jsonBody(request, contactBody) : jsonBody(request, assistanceBody)
    const parsed = z.uuidv4().safeParse(request.get('Idempotency-Key'))
    if (!parsed.success) throw new ApiError(400, 'MALFORMED_REQUEST', 'Une clé de soumission valide est requise.')
    const key = parsed.data
    if (!config.IDEMPOTENCY_KEY_SECRET) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Le formulaire est temporairement indisponible.')
    const fingerprint = keyedDigest(config.IDEMPOTENCY_KEY_SECRET, JSON.stringify(input))
    const receiptFields = { id: true, reference: true, createdAt: true } as const

    const receipt = await database.$transaction(async transaction => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${action + ':' + key}, 0))`
      const now = new Date()
      const prior = await transaction.submissionKey.findUnique({
        where: { action_key: { action, key } },
        include: { message: { select: receiptFields }, case: { select: receiptFields } },
      })
      const original = prior?.message ?? prior?.case
      if (prior && original && prior.expiresAt > now) {
        if (!Buffer.from(prior.bodyFingerprint).equals(fingerprint)) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Cette clé correspond à un autre envoi.')
        return original
      }
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock_shared(381972, 3)`
      const notice = await intakeNotice(transaction, config, form)
      if (!notice.text || !notice.noticeVersion) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Le formulaire est temporairement indisponible.')
      if (input.noticeVersion !== notice.noticeVersion) throw new ApiError(409, 'NOTICE_CHANGED', 'La notice de confidentialité a changé.')
      if (prior) await transaction.submissionKey.deleteMany({ where: { action, key } })
      const snapshot = { fullName: input.fullName, phone: input.phone, noticeVersion: input.noticeVersion, noticeText: notice.text, acknowledgedAt: now }
      const reference = (contact ? 'MSG-' : 'ASS-') + randomBytes(12).toString('hex').toUpperCase()
      let saved: { id: string; reference: string; createdAt: Date }
      if ('message' in input) {
        saved = await transaction.contactMessage.create({
          data: { ...snapshot, reference, email: input.email, subject: input.subject, message: input.message }, select: receiptFields,
        })
      } else {
        const [product] = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM insurance_products WHERE slug = ${input.productSlug}::product_slug AND is_active AND is_published FOR SHARE
        `
        if (!product) throw new ApiError(409, 'PRODUCT_UNAVAILABLE', 'Cette assurance est indisponible.')
        saved = await transaction.assistanceCase.create({
          data: { ...snapshot, reference, productId: product.id, description: input.description, contractReference: input.contractReference },
          select: receiptFields,
        })
      }
      const link = contact ? { messageId: saved.id } : { caseId: saved.id }
      await transaction.submissionKey.create({
        data: { ...link, action, key, bodyFingerprint: fingerprint, expiresAt: new Date(now.getTime() + 86_400_000) },
      })
      if (config.SMTP_MODE !== 'disabled') {
        const preferences = notificationPolicy(await agencySettings(transaction), config).delivery
        if (preferences[form].enabled && preferences[form].recipient) {
          const kind = contact ? 'CONTACT_ALERT' : 'ASSISTANCE_ALERT'
          await transaction.outboxJob.create({ data: { ...link, kind, dedupeKey: kind + ':' + saved.id, nextAttemptAt: now } })
        }
        if (contact && preferences.contactAcknowledgement) {
          await transaction.outboxJob.create({
            data: { messageId: saved.id, kind: 'CONTACT_ACK', dedupeKey: 'CONTACT_ACK:' + saved.id, nextAttemptAt: now },
          })
        }
      }
      await transaction.auditEvent.create({
        data: { requestId: response.locals.requestId, action: contact ? 'CONTACT_RECEIVED' : 'ASSISTANCE_RECEIVED', targetType: contact ? 'contact_message' : 'assistance_case', targetId: saved.id },
      })
      return saved
    })
    response.status(201).json({ data: { reference: receipt.reference, receivedAt: receipt.createdAt } })
  })
  return routes
}
