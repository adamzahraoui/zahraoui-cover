import type { AgencyContentKind, AgencySettings, Prisma } from '@prisma/client'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { emailField } from '../auth/contracts.js'
import { idleMs } from '../auth/session.js'
import type { Session } from '../auth/session.js'
import { phoneField } from '../business-inputs.js'
import { partnerWebsite as httpsUrl } from '../partners/model.js'

export const agencyId = '00000000-0000-4000-8000-000000000001'
export const official = { agencyName: 'Zahraoui Cover', officePhone: '+212523281585', assistancePhone: '+212522542323' }
const text = (max: number) => z.string().trim().min(1).max(max).nullable()
const brandManifest: Record<string, string> = {}
const social = z.strictObject({
  facebook: httpsUrl.nullable(), instagram: httpsUrl.nullable(), linkedin: httpsUrl.nullable(),
})
export const publicFields = z.strictObject({
  agencyName: z.string().trim().min(2).max(120), officePhone: phoneField, assistancePhone: phoneField,
  legalName: text(180), email: emailField.nullable(), address: text(300), city: text(100), hours: text(300),
  whatsappPhone: phoneField.nullable(), website: httpsUrl.nullable(), socialLinks: social,
  registration: text(300), authorization: text(300),
  brandAsset: z.string().max(100).refine(key => Object.hasOwn(brandManifest, key)).nullable(),
})
const alert = z.strictObject({ enabled: z.boolean(), recipient: emailField.nullable() })
  .refine(item => !item.enabled || item.recipient !== null, { message: 'Un destinataire est obligatoire.' })
export const notificationsSchema = z.strictObject({
  quote: alert, contact: alert, assistance: alert, renewal: alert, quoteAcknowledgement: z.boolean(), contactAcknowledgement: z.boolean(),
})
export const reminderDaysSchema = z.array(z.number().int().min(1).max(365)).min(1).max(12)
  .refine(items => new Set(items).size === items.length, { message: 'Les délais doivent être distincts.' })
export type NotificationPreferences = z.infer<typeof notificationsSchema>

export function companyFields(row: AgencySettings | null) {
  return {
    agencyName: row?.agencyName ?? official.agencyName, officePhone: row?.officePhone ?? official.officePhone,
    assistancePhone: row?.assistancePhone ?? official.assistancePhone,
    legalName: row?.legalName ?? null, email: row?.email ?? null, address: row?.address ?? null, city: row?.city ?? null,
    hours: row?.hours ?? null, whatsappPhone: row?.whatsappPhone ?? null, website: row?.website ?? null,
    socialLinks: social.safeParse(row?.socialLinks).data ?? { facebook: null, instagram: null, linkedin: null },
    registration: row?.registration ?? null, authorization: row?.authorization ?? null,
    logoUrl: row?.brandAsset && Object.hasOwn(brandManifest, row.brandAsset) ? brandManifest[row.brandAsset] : null,
  }
}

export function publicCompany(row: AgencySettings | null) {
  return companyFields(row?.publicApprovedAt ? row : null)
}

export function agencySettings(db: Prisma.TransactionClient) {
  return db.agencySettings.findUnique({ where: { id: 1 } })
}

export function published(db: Prisma.TransactionClient, kind: AgencyContentKind) {
  return db.agencyContent.findFirst({ where: { kind, publishedAt: { not: null } }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }] })
}

export async function intakeNotice(db: Prisma.TransactionClient, config: Config, form: 'quote' | 'contact' | 'assistance') {
  const notice = await published(db, 'PRIVACY')
  if (notice) return { noticeVersion: notice.id.replaceAll('-', ''), text: notice.body }
  const text = { quote: config.QUOTE_NOTICE_TEXT, contact: config.CONTACT_NOTICE_TEXT, assistance: config.ASSISTANCE_NOTICE_TEXT }[form] ?? null
  return { noticeVersion: text ? config.PRIVACY_NOTICE_VERSION ?? null : null, text }
}

export function fallbackPreferences(config: Config): NotificationPreferences {
  const recipient = config.INTAKE_NOTIFY_EMAIL ?? null
  return {
    quote: { enabled: Boolean(recipient), recipient }, contact: { enabled: Boolean(recipient), recipient },
    assistance: { enabled: Boolean(recipient), recipient },
    renewal: { enabled: Boolean(config.RENEWAL_NOTIFY_EMAIL), recipient: config.RENEWAL_NOTIFY_EMAIL ?? null },
    quoteAcknowledgement: config.QUOTE_ACK_EMAIL, contactAcknowledgement: config.CONTACT_ACK_EMAIL,
  }
}

export function notificationPolicy(row: AgencySettings | null, config: Config) {
  const configured = notificationsSchema.safeParse(row?.notificationPreferences).data
  const preferences = configured ?? fallbackPreferences(config)
  const delivery = configured && !localMail(config)
    ? { ...preferences, quote: { enabled: false, recipient: null }, contact: { enabled: false, recipient: null },
      assistance: { enabled: false, recipient: null }, renewal: { enabled: false, recipient: null },
      quoteAcknowledgement: false, contactAcknowledgement: false }
    : preferences
  return { preferences, delivery, offsets: row?.reminderDays.length ? row.reminderDays : config.RENEWAL_REMINDER_DAYS,
    scheduleRenewals: configured?.renewal.enabled ?? true }
}

export function localMail(config: Config) {
  return config.NODE_ENV !== 'production' && config.SMTP_MODE === 'local' &&
    (['127.0.0.1', '::1', 'localhost'].includes(config.SMTP_HOST ?? '') ||
      (config.NODE_ENV === 'test' && config.STAGING_MODE && config.SMTP_HOST === 'mailpit'))
}

export async function lockAdmin(db: Prisma.TransactionClient, session: Session) {
  const [staff] = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM staff_users WHERE id=${session.user.id}::uuid AND is_active AND role='ADMIN' FOR SHARE
  `
  const [active] = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM admin_sessions WHERE id=${session.id}::uuid AND staff_id=${session.user.id}::uuid
      AND revoked_at IS NULL AND expires_at>now() AND last_seen_at>${new Date(Date.now() - idleMs)} FOR SHARE
  `
  if (!staff || !active) throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé.')
}
