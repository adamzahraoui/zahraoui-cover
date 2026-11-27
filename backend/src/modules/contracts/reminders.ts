import type { Contract, OutboxJob, Prisma, PrismaClient } from '@prisma/client'
import type { Config } from '../../config/env.js'
import { casablancaDate } from '../business-inputs.js'
import type { Mailer } from '../notifications/mail-jobs.js'
import { claimJob, maxAttempts, retryTime } from '../notifications/outbox.js'
import { addDays, contractConflict, dateOnly, lockContract } from './model.js'

const reminderKind = 'RENEWAL_ALERT' as const
const idleStates = ['PENDING', 'RUNNING'] as const

export async function scheduleReminders(db: Prisma.TransactionClient, contract: Pick<Contract, 'id' | 'expiresOn' | 'renewalReminders'>, config: Config, now = new Date()) {
  if (!contract.renewalReminders) return
  const today = casablancaDate(now)
  const end = dateOnly(contract.expiresOn)
  if (end <= today) return
  const deadlines = config.RENEWAL_REMINDER_DAYS.map(days => ({ days, day: addDays(end, -days) }))
    .sort((left, right) => left.day.localeCompare(right.day))
  const mostRecentDue = deadlines.filter(item => item.day <= today).at(-1)
  for (const item of deadlines) {
    if (item.day <= today && item !== mostRecentDue) continue
    const [time] = await db.$queryRaw<{ at: Date }[]>`
      SELECT (${item.day}::date + TIME '09:00') AT TIME ZONE 'Africa/Casablanca' AS at
    `
    await db.outboxJob.createMany({ skipDuplicates: true, data: {
      kind: reminderKind, contractId: contract.id, reminderExpiresOn: contract.expiresOn, reminderDays: item.days,
      dedupeKey: `renewal:${contract.id}:${end}:${item.days}`, nextAttemptAt: time.at > now ? time.at : now,
    } })
  }
}

export async function obsoleteReminders(db: Prisma.TransactionClient, contractId: string) {
  if (await db.outboxJob.count({ where: { kind: reminderKind, contractId, state: 'RUNNING', leaseUntil: { gt: new Date() } } })) {
    throw contractConflict('Un rappel est en cours d’envoi. Réessayez après son traitement.')
  }
  await db.outboxJob.updateMany({
    where: { kind: reminderKind, contractId, state: { in: [...idleStates] } },
    data: { state: 'FAILED', finishedAt: new Date(), lastErrorCode: 'RENEWAL_OBSOLETE', leaseUntil: null, leaseToken: null },
  })
}

async function complete(db: PrismaClient, job: OutboxJob, result: 'accepted' | 'obsolete' | 'error') {
  const now = new Date()
  const retry = result === 'error' && job.attemptCount < maxAttempts
  await db.$transaction(async transaction => {
    const changed = await transaction.outboxJob.updateMany({
      where: { id: job.id, state: 'RUNNING', leaseToken: job.leaseToken },
      data: { state: result === 'accepted' ? 'SUCCEEDED' : retry ? 'PENDING' : 'FAILED',
        leaseUntil: null, leaseToken: null, finishedAt: retry ? null : now,
        lastErrorCode: result === 'accepted' ? null : result === 'obsolete' ? 'RENEWAL_OBSOLETE' : 'RENEWAL_SMTP_FAILED',
        nextAttemptAt: retry ? retryTime(job.attemptCount) : now },
    })
    if (!changed.count || retry || !job.contractId || result === 'obsolete') return
    await transaction.auditEvent.create({ data: {
      action: result === 'accepted' ? 'CONTRACT_REMINDER_DELIVERED' : 'CONTRACT_REMINDER_FAILED',
      targetType: 'contract', targetId: job.contractId,
    } })
  })
}

export async function deliverNextRenewal(db: PrismaClient, config: Config, mailer: Mailer) {
  if (config.NODE_ENV === 'production' || config.SMTP_MODE !== 'local' || !config.RENEWAL_NOTIFY_EMAIL) return false
  const claim = await claimJob(db, [reminderKind])
  if (!claim) return false
  const job = await db.outboxJob.findFirst({ where: claim })
  if (!job) return true
  const contractId = job.contractId
  const term = job.reminderExpiresOn
  if (!contractId || !term || !job.reminderDays) {
    await complete(db, job, 'obsolete')
    return true
  }
  const now = new Date()
  const policy = await db.$transaction(async transaction => {
    await lockContract(transaction, contractId)
    const current = await transaction.contract.findUniqueOrThrow({ where: { id: contractId }, select: {
      reference: true, status: true, expiresOn: true, confirmationOn: true, renewalReminders: true,
      successors: { where: { activatedAt: { not: null } }, take: 1, select: { id: true } },
    } })
    if (current.status !== 'ACTIVE' || !current.confirmationOn || !current.renewalReminders || current.successors.length ||
        dateOnly(current.expiresOn) !== dateOnly(term) || dateOnly(term) <= casablancaDate(now) ||
        !config.RENEWAL_REMINDER_DAYS.includes(job.reminderDays!)) return undefined
    // Once a later reminder is due (or already sent), older pending windows are obsolete.
    const [window] = await transaction.$queryRaw<{ newer: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM outbox_jobs
        WHERE kind='RENEWAL_ALERT' AND contract_id=${contractId}::uuid AND reminder_expires_on=${term}::date
          AND reminder_days < ${job.reminderDays!} AND reminder_days = ANY(${config.RENEWAL_REMINDER_DAYS}::int[])
          AND ((reminder_expires_on - reminder_days + TIME '09:00') AT TIME ZONE 'Africa/Casablanca') <= ${now}
      ) AS newer
    `
    return window.newer ? undefined : current
  })
  if (!policy) {
    await complete(db, job, 'obsolete')
    return true
  }
  try {
    const mail = await mailer.sendMail({
      from: config.SMTP_FROM, to: { name: '', address: config.RENEWAL_NOTIFY_EMAIL },
      subject: 'Zahraoui Cover - Échéance à préparer ' + policy.reference,
      text: `Référence interne : ${policy.reference}\nÉchéance : ${dateOnly(policy.expiresOn)}\nConsultez le contrat dans l’espace sécurisé : ${new URL('/admin/contrats/' + contractId, config.PUBLIC_ORIGIN).href}\nCe rappel ne confirme aucun renouvellement.`,
      messageId: '<zc-renewal-' + job.id + '@' + config.SMTP_FROM?.split('@')[1] + '>',
    })
    if (!mail.accepted.length) throw new Error('Reminder rejected')
  } catch {
    await complete(db, job, 'error')
    return true
  }
  await complete(db, job, 'accepted')
  return true
}

export async function maintainContracts(db: PrismaClient, now = new Date()) {
  const today = casablancaDate(now)
  await db.$transaction(async transaction => {
    await transaction.$executeRaw`
      WITH expired AS (
        UPDATE contracts SET status='EXPIRED', version=version+1, updated_at=${now}
        WHERE status='ACTIVE' AND expires_on <= ${today}::date RETURNING id
      )
      INSERT INTO audit_events (action,target_type,target_id) SELECT 'CONTRACT_EXPIRED','contract',id FROM expired
    `
    await transaction.$executeRaw`
      UPDATE outbox_jobs AS job SET state='FAILED', last_error_code='RENEWAL_OBSOLETE', finished_at=${now}, lease_until=NULL, lease_token=NULL
      FROM contracts AS policy
      WHERE job.kind='RENEWAL_ALERT' AND job.contract_id=policy.id AND (job.state='PENDING' OR
        (job.state='RUNNING' AND job.lease_until<=${now}))
        AND (policy.status<>'ACTIVE' OR policy.confirmation_on IS NULL OR NOT policy.renewal_reminders OR
           job.reminder_expires_on IS DISTINCT FROM policy.expires_on OR
           EXISTS (SELECT 1 FROM contracts successor WHERE successor.previous_id=policy.id AND successor.activated_at IS NOT NULL))
    `
    await transaction.outboxJob.updateMany({
      where: { kind: reminderKind, state: 'RUNNING', leaseUntil: { lte: now }, attemptCount: { gte: maxAttempts } },
      data: { state: 'FAILED', lastErrorCode: 'RENEWAL_EXHAUSTED', leaseUntil: null, leaseToken: null, finishedAt: now },
    })
  })
}
