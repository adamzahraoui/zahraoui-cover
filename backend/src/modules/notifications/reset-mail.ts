import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import nodemailer from 'nodemailer'
import type { Config } from '../../config/env.js'
import { openResetToken, tokenFormat } from '../../utils/crypto.js'

const leaseMs = 90_000
const maxAttempts = 5

export function resetMailer(config: Config) {
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

type Mailer = NonNullable<ReturnType<typeof resetMailer>>

export async function deliverNextReset(database: PrismaClient, config: Config, mailer: Mailer) {
  const now = new Date()
  const leaseToken = randomUUID()
  const leaseUntil = new Date(now.getTime() + leaseMs)
  const [claimed] = await database.$queryRaw<{ id: string }[]>`
    WITH next_job AS (
      SELECT id FROM outbox_jobs
      WHERE kind = 'RESET_EMAIL' AND attempt_count < ${maxAttempts}
        AND ((state = 'PENDING' AND next_attempt_at <= ${now}) OR (state = 'RUNNING' AND lease_until <= ${now}))
      ORDER BY next_attempt_at, id
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_jobs AS job SET
      state = 'RUNNING', lease_until = ${leaseUntil}, lease_token = ${leaseToken}::uuid,
      attempt_count = attempt_count + 1
    FROM next_job WHERE job.id = next_job.id
    RETURNING job.id
  `
  if (!claimed) return false

  const job = await database.outboxJob.findFirst({
    where: { id: claimed.id, leaseToken },
    include: { reset: { include: { staff: { select: { email: true, isActive: true } } } } },
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
    if (code && changed.count) console.warn(JSON.stringify({ event: 'reset_job_failed', jobId: job.id, code }))
  }

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
  try {
    await mailer.sendMail({
      from: config.SMTP_FROM,
      to: reset.staff.email,
      messageId: `<reset-${job.id}@${config.SMTP_FROM?.split('@')[1]}>`,
      subject: 'Zahraoui Cover · Configuration ou réinitialisation du mot de passe',
      text: `Ouvrez ce lien à usage unique afin de choisir votre mot de passe :\n\n${link.href}\n\nLe lien expire après 30 minutes. Si cette démarche ne vous concerne pas, ignorez ce message.`,
    })
  } catch {
    const retryAt = new Date(Date.now() + 15_000 * 2 ** (job.attemptCount - 1))
    if (job.attemptCount >= maxAttempts || retryAt >= reset.expiresAt) await finish('SMTP_DELIVERY_FAILED')
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
      kind: 'RESET_EMAIL',
      state: { in: ['RUNNING', 'PENDING'] },
      OR: [{ reset: { expiresAt: { lte: now } } }, { attemptCount: { gte: maxAttempts }, leaseUntil: { lte: now } }],
    },
    data: {
      state: 'FAILED', encryptedSecret: null, leaseToken: null, leaseUntil: null,
      finishedAt: now, lastErrorCode: 'RESET_EXPIRED_OR_EXHAUSTED',
    },
  })
  if (exhausted.count) console.warn(JSON.stringify({ event: 'reset_jobs_expired_or_exhausted', count: exhausted.count }))
  await database.rateLimit.deleteMany({ where: { expiresAt: { lte: now } } })
  await database.adminSession.deleteMany({
    where: { OR: [{ expiresAt: { lt: weekAgo } }, { revokedAt: { lt: weekAgo } }, { lastSeenAt: { lt: inactiveSince } }] },
  })
  await database.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: weekAgo } }, { usedAt: { lt: weekAgo } }, { invalidatedAt: { lt: weekAgo } }] },
  })
}
