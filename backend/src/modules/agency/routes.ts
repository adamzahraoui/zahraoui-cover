import { AgencyContentKind, Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { currentSession, requireCsrf, requireRole } from '../auth/session.js'
import { pageBounds, pagination, parseQuery, versionField } from '../business-inputs.js'
import { lockRenewalConfiguration, reconcileRenewals } from '../contracts/reminders.js'
import { recordHistory, staffAudit, staleRecord } from '../staff-records.js'
import { agencyId, agencySettings, companyFields, localMail, lockAdmin, notificationPolicy, notificationsSchema, publicCompany, publicFields, published, reminderDaysSchema } from './model.js'

const kinds = z.enum(AgencyContentKind)
const contentBody = z.string().trim().min(20).max(8000)
const contentSelect = { id: true, kind: true, body: true, version: true, createdAt: true, publishedAt: true,
  publisher: { select: { displayName: true } } } satisfies Prisma.AgencyContentSelect
const editable = publicFields.partial().extend({ version: versionField, approved: z.literal(true) })
  .refine(value => Object.keys(value).length > 2)

function missing() {
  return new ApiError(404, 'NOT_FOUND', 'Contenu introuvable.')
}

export function publicAgencyRoutes(db: PrismaClient) {
  const routes = Router()
  routes.get('/', async (_request, response) => {
    const [company, legal, privacy, cookies] = await db.$transaction([
      agencySettings(db), published(db, 'LEGAL'), published(db, 'PRIVACY'), published(db, 'COOKIES'),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: { ...publicCompany(company), content: {
      legal: legal?.body ?? null, privacy: privacy?.body ?? null, cookies: cookies?.body ?? null,
    } } })
  })
  return routes
}

async function settingsData(db: Prisma.TransactionClient, config: Config) {
  const row = await agencySettings(db)
  const policy = notificationPolicy(row, config)
  return { ...companyFields(row), publicApprovedAt: row?.publicApprovedAt ?? null, brandAsset: row?.brandAsset ?? null, version: row?.version ?? 1,
    notifications: policy.preferences, reminderDays: policy.offsets, localMail: localMail(config),
    activity: await recordHistory(db, 'agency', agencyId),
  }
}

export function agencyAdminRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  routes.use(requireRole('ADMIN'))
  routes.get('/', async (_request, response) => response.json({ data: await settingsData(db, config) }))
  routes.patch('/', requireCsrf, async (request, response) => {
    const { version, approved, ...body } = jsonBody(request, editable)
    await db.$transaction(async transaction => {
      await lockAdmin(transaction, currentSession(response))
      const result = await transaction.agencySettings.updateMany({ where: { id: 1, version }, data: { ...body, publicApprovedAt: new Date(), version: { increment: 1 } } })
      if (!result.count) throw staleRecord()
      await staffAudit(transaction, response, 'agency', agencyId, 'AGENCY_PUBLIC_UPDATED', { fields: Object.keys(body), approved })
    })
    response.json({ data: await settingsData(db, config) })
  })
  routes.patch('/notifications', requireCsrf, async (request, response) => {
    const { version, notifications, reminderDays } = jsonBody(request, z.strictObject({
      version: versionField, notifications: notificationsSchema, reminderDays: reminderDaysSchema,
    }))
    await db.$transaction(async transaction => {
      await lockAdmin(transaction, currentSession(response))
      await lockRenewalConfiguration(transaction)
      const row = await agencySettings(transaction)
      if (!row || row.version !== version) throw staleRecord()
      const before = notificationPolicy(row, config)
      const days = [...reminderDays].sort((a, b) => b - a)
      const result = await transaction.agencySettings.updateMany({ where: { id: 1, version }, data: {
        notificationPreferences: notifications, reminderDays: days, version: { increment: 1 },
      } })
      if (!result.count) throw staleRecord()
      if (before.scheduleRenewals !== notifications.renewal.enabled || JSON.stringify(before.offsets) !== JSON.stringify(days) ||
          before.preferences.renewal.recipient !== notifications.renewal.recipient) {
        await reconcileRenewals(transaction, notifications.renewal.enabled ? days : [])
      }
      await staffAudit(transaction, response, 'agency', agencyId, 'AGENCY_NOTIFICATIONS_UPDATED', {
        remindersEnabled: notifications.renewal.enabled, reminderDays: days,
      })
    })
    response.json({ data: await settingsData(db, config) })
  })
  routes.get('/content', async (request, response) => {
    const input = parseQuery(z.strictObject({ kind: kinds, page: pagination.page, limit: pagination.limit }), request.query)
    const { page, limit, skip } = pageBounds(input)
    const where = { kind: input.kind }
    const [data, total] = await db.$transaction([
      db.agencyContent.findMany({ where, skip, take: limit, select: contentSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      db.agencyContent.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data, meta: { page, limit, total } })
  })
  routes.post('/content', requireCsrf, async (request, response) => {
    const input = jsonBody(request, z.strictObject({ kind: kinds, body: contentBody }))
    const data = await db.$transaction(async transaction => {
      await lockAdmin(transaction, currentSession(response))
      const row = await transaction.agencyContent.create({ data: input, select: contentSelect })
      await staffAudit(transaction, response, 'agency', agencyId, 'AGENCY_CONTENT_DRAFTED', { contentId: row.id, kind: row.kind })
      return row
    })
    response.status(201).json({ data })
  })

  async function changeContent(id: string, version: number, response: Parameters<typeof currentSession>[0], body?: string) {
    return db.$transaction(async transaction => {
      const session = currentSession(response)
      await lockAdmin(transaction, session)
      const row = await transaction.agencyContent.findUnique({ where: { id } })
      if (!row) throw missing()
      if (row.version !== version || row.publishedAt) throw staleRecord()
      // Serialize publication and intake reads. Historical rows are immutable.
      if (body === undefined) await transaction.$executeRaw`SELECT pg_advisory_xact_lock(381972, 3)`
      const updated = await transaction.agencyContent.updateMany({ where: { id, version, publishedAt: null }, data: {
        version: { increment: 1 }, ...(body === undefined ? { publishedAt: new Date(), publisherId: session.user.id } : { body }),
      } })
      if (!updated.count) throw staleRecord()
      await staffAudit(transaction, response, 'agency', agencyId, body === undefined ? 'AGENCY_CONTENT_PUBLISHED' : 'AGENCY_CONTENT_UPDATED',
        { contentId: row.id, kind: row.kind })
      return transaction.agencyContent.findUniqueOrThrow({ where: { id }, select: contentSelect })
    })
  }

  routes.patch('/content/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, body } = jsonBody(request, z.strictObject({ version: versionField, body: contentBody }))
    response.json({ data: await changeContent(id, version, response, body) })
  })
  routes.post('/content/:id/publish', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, z.strictObject({ version: versionField, approved: z.literal(true) }))
    response.json({ data: await changeContent(id, version, response) })
  })
  routes.get('/readiness', async (_request, response) => {
    const [agency, legal, privacy, quote, products] = await Promise.all([
      agencySettings(db), published(db, 'LEGAL'), published(db, 'PRIVACY'), published(db, 'QUOTE'),
      db.insuranceProduct.count({ where: { isActive: true, isPublished: true } }),
    ])
    const ready = (id: string, yes: boolean, detail?: string) => ({ id, state: yes ? 'VERIFIED' : 'PENDING', detail })
    const configured = (id: string, yes: boolean) => ({ id, state: yes ? 'CONFIGURED' : 'PENDING' })
    response.json({ data: [
      ready('logo', Boolean(publicCompany(agency).logoUrl)), ready('legal', Boolean(legal)), ready('privacy', Boolean(privacy)),
      ready('catalog', products === 6, products + ' / 6'), ready('quote', Boolean(quote)),
      configured('smtp', (config.SMTP_MODE === 'tls' || config.SMTP_MODE === 'starttls') && Boolean(config.SMTP_HOST && config.SMTP_FROM)),
      ready('malware', false), ready('storage', false), ready('migration', false), ready('backup', false),
      configured('https', config.PUBLIC_ORIGIN.startsWith('https://')),
    ] })
  })
  return routes
}
