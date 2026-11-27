import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { Config } from '../../config/env.js'
import { digestToken, randomToken, sealResetToken } from '../../utils/crypto.js'

const resetTtlMs = 30 * 60 * 1000

export async function lockStaff(transaction: Prisma.TransactionClient, staffId: string) {
  await transaction.$queryRaw`SELECT id FROM staff_users WHERE id = ${staffId}::uuid FOR UPDATE`
  return transaction.staffUser.findUnique({ where: { id: staffId } })
}

export async function queueReset(transaction: Prisma.TransactionClient, config: Config, staffId: string, now: Date) {
  // The caller locks the staff row so two requests cannot leave two valid links.
  await transaction.passwordResetToken.updateMany({
    where: { staffId, usedAt: null, invalidatedAt: null },
    data: { invalidatedAt: now },
  })
  await transaction.outboxJob.updateMany({
    where: { kind: 'RESET_EMAIL', reset: { staffId }, state: { in: ['PENDING', 'RUNNING'] } },
    data: { state: 'FAILED', encryptedSecret: null, leaseToken: null, leaseUntil: null, finishedAt: now, lastErrorCode: 'RESET_REPLACED' },
  })

  const id = randomUUID()
  const token = randomToken()
  await transaction.passwordResetToken.create({
    data: { id, staffId, tokenHash: digestToken(token), expiresAt: new Date(now.getTime() + resetTtlMs) },
  })
  await transaction.outboxJob.create({
    data: {
      kind: 'RESET_EMAIL',
      dedupeKey: `reset:${id}`,
      resetId: id,
      encryptedSecret: sealResetToken(config.RESET_JOB_KEY, id, token),
      nextAttemptAt: now,
    },
  })
}
