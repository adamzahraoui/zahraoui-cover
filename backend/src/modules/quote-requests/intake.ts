import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { keyedDigest } from '../../utils/crypto.js'
import { emailField } from '../auth/contracts.js'
import { requireAttempt, takeAttempt } from '../auth/limits.js'
import { casablancaDate, productSlug, profile } from '../business-inputs.js'
import type { PublicSlug } from '../business-inputs.js'

const contexts: Record<PublicSlug, string[]> = {
  automobile: ['Véhicule personnel', 'Véhicule professionnel', 'Flotte de véhicules'],
  habitation: ['Appartement', 'Maison', 'Autre logement'],
  sante: ['Individuelle', 'Familiale', 'Collective'],
  voyage: ['Voyage privé', 'Déplacement professionnel', 'Voyages récurrents'],
  professionnelle: ['Indépendant', 'PME', 'Autre entreprise'],
  'responsabilite-civile': ['Vie privée', 'Exploitation', 'Activité professionnelle'],
}

const mergedNeeds = (needs: string, context?: string) => context ? `Contexte : ${context}\n${needs}` : needs

export function normalizePhone(value: string) {
  const phone = value.replace(/[\s().-]/g, '')
  if (/^0[5-7]\d{8}$/.test(phone)) return '+212' + phone.slice(1)
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : undefined
}

const inputSchema = z.strictObject({
  profile,
  productSlug,
  desiredStartOn: z.iso.date().optional(),
  situation: z.enum(['NEW_POLICY', 'RENEWAL', 'SWITCH_PROVIDER']).default('NEW_POLICY'),
  needs: z.string().trim().min(10).max(1000),
  context: z.string().trim().min(1).max(80).optional(),
  firstName: z.string().trim().min(2).max(120),
  lastName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(32).transform((value, ctx) => {
    const result = normalizePhone(value)
    if (result) return result
    ctx.addIssue({ code: 'custom', message: 'Numéro invalide.' })
    return z.NEVER
  }),
  email: emailField,
  city: z.string().trim().min(2).max(100),
  preferredContact: z.enum(['PHONE', 'EMAIL']).default('PHONE'),
  noticeVersion: z.string().regex(/^[a-zA-Z0-9._-]{1,32}$/),
  acknowledged: z.literal(true),
}).superRefine((input, ctx) => {
  if (input.context && !contexts[input.productSlug].includes(input.context)) {
    ctx.addIssue({ code: 'custom', path: ['context'], message: 'Contexte incompatible.' })
  }
  if (mergedNeeds(input.needs, input.context).length > 1000) {
    ctx.addIssue({ code: 'custom', path: ['needs'], message: 'Le texte et son contexte sont trop longs.' })
  }
})
const keySchema = z.uuidv4()
const ttl = 24 * 60 * 60 * 1000

function unavailable() {
  return new ApiError(409, 'PRODUCT_UNAVAILABLE', 'Cette assurance n’est plus disponible pour le profil choisi.')
}

export function quoteIntakeRoutes(database: PrismaClient, config: Config) {
  const routes = Router()
  routes.get('/notice', (_request, response) => {
    response.json({ data: { noticeVersion: config.PRIVACY_NOTICE_VERSION ?? null, text: config.QUOTE_NOTICE_TEXT ?? null } })
  })

  routes.post('/', async (request, response) => {
    const source = request.ip ?? request.socket.remoteAddress ?? 'unknown'
    requireAttempt(response, await takeAttempt(database, config.RATE_KEY_SECRET, 'quote_source', source, 10, 15 * 60 * 1000))
    const input = jsonBody(request, inputSchema)
    const key = keySchema.safeParse(request.get('Idempotency-Key'))
    if (!key.success) throw new ApiError(400, 'MALFORMED_REQUEST', 'Une clé de soumission valide est requise.')
    const requestKey = key.data
    const secret = config.IDEMPOTENCY_KEY_SECRET
    if (!secret) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Le formulaire est temporairement indisponible.')
    const fingerprint = keyedDigest(secret, JSON.stringify(input))
    const requestId = response.locals.requestId

    async function persist() {
      return database.$transaction(async transaction => {
        // Only one transaction can decide what a submitted key means.
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'quote:' + requestKey}, 0))`
        const now = new Date()
        const prior = await transaction.submissionKey.findUnique({
          where: { action_key: { action: 'QUOTE_REQUEST', key: requestKey } },
          include: { request: { select: { reference: true, createdAt: true } } },
        })
        if (prior && prior.expiresAt > now && prior.request) {
          if (!Buffer.from(prior.bodyFingerprint).equals(fingerprint)) {
            throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Cette clé correspond à une autre demande.')
          }
          return prior.request
        }
        if (prior) await transaction.submissionKey.deleteMany({ where: { action: prior.action, key: prior.key } })

        if (!config.PRIVACY_NOTICE_VERSION || !config.QUOTE_NOTICE_TEXT) {
          throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Le formulaire est temporairement indisponible.')
        }
        if (input.noticeVersion !== config.PRIVACY_NOTICE_VERSION) throw new ApiError(409, 'NOTICE_CHANGED', 'La notice de confidentialité a changé.')
        if (input.desiredStartOn && input.desiredStartOn < casablancaDate(now)) {
          throw new ApiError(422, 'VALIDATION_FAILED', 'La date d’effet doit être aujourd’hui ou plus tard.', { desiredStartOn: 'Date passée.' })
        }

        const [locked] = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM insurance_products WHERE slug = ${input.productSlug}::product_slug FOR SHARE
        `
        if (!locked) throw unavailable()
        const product = await transaction.insuranceProduct.findUniqueOrThrow({ where: { id: locked.id } })
        if (!product.isActive || !product.isPublished || !product.audiences.includes(input.profile)) throw unavailable()

        // Public contact information is unverified. Never overwrite or attach to someone else's dossier.
        const client = await transaction.client.create({ data: {
          profile: input.profile, displayName: `${input.firstName} ${input.lastName}`.slice(0, 120),
          phone: input.phone, email: input.email, city: input.city, intakeProvisional: true,
        }, select: { id: true } })
        const saved = await transaction.quoteRequest.create({
          data: {
            reference: 'DEV-' + randomBytes(12).toString('hex').toUpperCase(),
            clientId: client.id, productId: product.id, profile: input.profile,
            firstName: input.firstName, lastName: input.lastName, phone: input.phone, email: input.email, city: input.city,
            preferredContact: input.preferredContact, situation: input.situation,
            desiredStartOn: input.desiredStartOn ? new Date(input.desiredStartOn + 'T00:00:00.000Z') : undefined,
            needs: mergedNeeds(input.needs, input.context), noticeVersion: input.noticeVersion, acknowledgedAt: now,
          },
          select: { id: true, reference: true, createdAt: true },
        })
        await transaction.submissionKey.create({ data: {
          action: 'QUOTE_REQUEST', key: requestKey, bodyFingerprint: fingerprint, requestId: saved.id,
          expiresAt: new Date(now.getTime() + ttl),
        } })
        if (config.SMTP_MODE !== 'disabled') {
          if (config.QUOTE_ACK_EMAIL) await transaction.outboxJob.create({ data: {
            kind: 'REQUEST_ACK', requestId: saved.id, dedupeKey: `request-ack:${saved.id}`, nextAttemptAt: now,
          } })
          if (config.INTAKE_NOTIFY_EMAIL) await transaction.outboxJob.create({ data: {
            kind: 'REQUEST_ALERT', requestId: saved.id, dedupeKey: `request-alert:${saved.id}`, nextAttemptAt: now,
          } })
        }
        await transaction.auditEvent.create({ data: { requestId, action: 'QUOTE_REQUEST_RECEIVED', targetType: 'quote_request', targetId: saved.id } })
        return saved
      })
    }

    const receipt = await persist().catch(error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && String(error.meta?.target).includes('reference')) {
        return persist()
      }
      throw error
    })
    response.status(201).json({ data: { reference: receipt.reference, receivedAt: receipt.createdAt } })
  })
  return routes
}
