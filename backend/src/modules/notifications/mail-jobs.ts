import type { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'
import type { Config } from '../../config/env.js'
import { openResetToken, tokenFormat } from '../../utils/crypto.js'

import { claimJob, maxAttempts, retryTime } from './outbox.js'

export function smtpMailer(config: Config) {
  if (config.SMTP_MODE === 'disabled') return
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_MODE === 'tls',
    requireTLS: config.SMTP_MODE === 'starttls',
    ignoreTLS: config.SMTP_MODE === 'local',
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? '' } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12_000,
  })
}

export type Mailer = NonNullable<ReturnType<typeof smtpMailer>>

export async function deliverNextMail(database: PrismaClient, config: Config, mailer: Mailer) {
  const claimed = await claimJob(database, ['RESET_EMAIL', 'REQUEST_ACK', 'REQUEST_ALERT', 'CONTACT_ACK', 'CONTACT_ALERT', 'ASSISTANCE_ALERT'])
  if (!claimed) return false
  const { leaseToken } = claimed

  const job = await database.outboxJob.findFirst({
    where: { id: claimed.id, leaseToken },
    include: {
      reset: { include: { staff: { select: { email: true, isActive: true } } } },
      request: { select: { id: true, reference: true, email: true } },
      message: { select: { id: true, reference: true, email: true } },
      case: { select: { id: true, reference: true } },
    },
  })
  if (!job) return true

  const finish = async (code?: string) => {
    const changed = await database.outboxJob.updateMany({
      where: { id: job.id, leaseToken, state: 'RUNNING' },
      data: {
        state: code ? 'FAILED' : 'SUCCEEDED', finishedAt: new Date(), encryptedSecret: null,
        leaseToken: null, leaseUntil: null, lastErrorCode: code ?? null,
      },
    })
    if (code && changed.count) console.warn(JSON.stringify({ event: 'mail_job_failed', jobId: job.id, code }))
  }

  let delivery: { to: string; subject: string; text: string; expiresAt?: Date }
  if (job.kind === 'RESET_EMAIL') {
    const reset = job.reset
    if (!reset?.staff.isActive || reset.invalidatedAt || reset.usedAt || reset.expiresAt <= new Date() || !job.encryptedSecret) {
      await finish('RESET_INACTIVE')
      return true
    }

    let token: string
    try {
      token = openResetToken(config.RESET_JOB_KEY, reset.id, job.encryptedSecret)
      if (!tokenFormat.test(token)) throw new Error('Malformed reset token')
    } catch {
      await finish('RESET_SECRET_UNREADABLE')
      return true
    }

    const link = new URL('/admin/reinitialiser-mot-de-passe', config.PUBLIC_ORIGIN)
    link.hash = new URLSearchParams({ token }).toString()
    delivery = {
      to: reset.staff.email,
      subject: 'Zahraoui Cover · Configuration ou réinitialisation du mot de passe',
      text: `Ouvrez ce lien à usage unique afin de choisir votre mot de passe :\n\n${link.href}\n\nLe lien expire après 30 minutes. Si cette démarche ne vous concerne pas, ignorez ce message.`,
      expiresAt: reset.expiresAt,
    }
  } else if (job.kind === 'REQUEST_ACK' || job.kind === 'REQUEST_ALERT') {
    const request = job.request
    const to = job.kind === 'REQUEST_ACK' ? (config.QUOTE_ACK_EMAIL ? request?.email : undefined) : config.INTAKE_NOTIFY_EMAIL
    if (!request || !to) {
      await finish('RECIPIENT_UNAVAILABLE')
      return true
    }
    delivery = job.kind === 'REQUEST_ACK'
      ? { to, subject: 'Zahraoui Cover · Demande de devis reçue', text: `Votre demande de devis a bien été reçue. Référence : ${request.reference}. Conservez cette référence pour vos échanges avec l’agence.` }
      : { to, subject: 'Zahraoui Cover · Nouvelle demande de devis', text: `Référence : ${request.reference}\nConsultez la demande dans l’espace sécurisé : ${new URL('/admin/demandes/' + request.id, config.PUBLIC_ORIGIN).href}` }
  } else {
    const record = job.message ?? job.case
    const to = job.kind === 'CONTACT_ACK' ? (config.CONTACT_ACK_EMAIL ? job.message?.email : undefined) : config.INTAKE_NOTIFY_EMAIL
    if (!record || !to) {
      await finish('RECIPIENT_UNAVAILABLE')
      return true
    }
    if (job.kind === 'CONTACT_ACK') {
      delivery = { to, subject: 'Zahraoui Cover · Message reçu', text: `Votre message a bien été reçu. Référence : ${record.reference}.` }
    } else {
      const path = job.kind === 'CONTACT_ALERT' ? '/admin/messages' : '/admin/assistance'
      const link = new URL(path, config.PUBLIC_ORIGIN)
      link.searchParams.set('id', record.id)
      delivery = { to, subject: job.kind === 'CONTACT_ALERT' ? 'Zahraoui Cover · Nouveau message' : 'Zahraoui Cover · Nouvelle demande d’assistance',
        text: `Référence : ${record.reference}\nConsultez le dossier dans l’espace sécurisé : ${link.href}` }
    }
  }
  try {
    await mailer.sendMail({
      from: config.SMTP_FROM,
      to: delivery.to,
      messageId: `<zc-${job.kind.toLowerCase()}-${job.id}@${config.SMTP_FROM?.split('@')[1]}>`,
      subject: delivery.subject,
      text: delivery.text,
    })
  } catch {
    const retryAt = retryTime(job.attemptCount)
    if (job.attemptCount >= maxAttempts || (delivery.expiresAt !== undefined && retryAt >= delivery.expiresAt)) await finish('SMTP_DELIVERY_FAILED')
    else await database.outboxJob.updateMany({
      where: { id: job.id, leaseToken, state: 'RUNNING' },
      data: { state: 'PENDING', nextAttemptAt: retryAt, leaseToken: null, leaseUntil: null, lastErrorCode: 'SMTP_RETRY' },
    })
    return true
  }
  await finish()
  return true
}

export async function cleanAuthRecords(database: PrismaClient, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const inactiveSince = new Date(weekAgo.getTime() - 30 * 60 * 1000)
  const exhausted = await database.outboxJob.updateMany({
    where: {
      kind: { in: ['RESET_EMAIL', 'REQUEST_ACK', 'REQUEST_ALERT', 'CONTACT_ACK', 'CONTACT_ALERT', 'ASSISTANCE_ALERT'] },
      state: { in: ['RUNNING', 'PENDING'] },
      OR: [{ reset: { expiresAt: { lte: now } } }, { attemptCount: { gte: maxAttempts }, leaseUntil: { lte: now } }],
    },
    data: {
      state: 'FAILED', encryptedSecret: null, leaseToken: null, leaseUntil: null,
      finishedAt: now, lastErrorCode: 'MAIL_EXPIRED_OR_EXHAUSTED',
    },
  })
  if (exhausted.count) console.warn(JSON.stringify({ event: 'mail_jobs_expired_or_exhausted', count: exhausted.count }))
  await database.submissionKey.deleteMany({ where: { expiresAt: { lte: now } } })
  await database.rateLimit.deleteMany({ where: { expiresAt: { lte: now } } })
  await database.adminSession.deleteMany({
    where: { OR: [{ expiresAt: { lt: weekAgo } }, { revokedAt: { lt: weekAgo } }, { lastSeenAt: { lt: inactiveSince } }] },
  })
  await database.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: weekAgo } }, { usedAt: { lt: weekAgo } }, { invalidatedAt: { lt: weekAgo } }] },
  })
}
