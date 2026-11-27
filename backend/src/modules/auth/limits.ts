import type { Prisma, PrismaClient } from '@prisma/client'
import type { Response } from 'express'
import { ApiError } from '../../middleware/errors.js'
import { keyedDigest } from '../../utils/crypto.js'

export async function takeAttempt(
  database: PrismaClient, secret: Buffer, scope: string, identifier: string, maximum: number, windowMs: number,
) {
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const expiresAt = new Date(windowStart.getTime() + windowMs)
  const keyHash = keyedDigest(secret, `${scope}:${identifier}`)
  const count = await database.$executeRaw`
    INSERT INTO rate_limits (scope, key_hash, window_start, hits, expires_at)
    VALUES (${scope}, ${keyHash}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT (scope, key_hash, window_start) DO UPDATE SET hits = rate_limits.hits + 1
    WHERE rate_limits.hits < ${maximum}
  `
  return { allowed: count === 1, retryAfter: Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)), scope, keyHash, windowStart }
}

export function requireAttempt(response: Response, attempt: Awaited<ReturnType<typeof takeAttempt>>) {
  if (attempt.allowed) return
  response.set('Retry-After', String(attempt.retryAfter))
  throw new ApiError(429, 'RATE_LIMITED', 'Trop de tentatives. Réessayez plus tard.')
}

export async function releaseAttempt(transaction: Prisma.TransactionClient, attempt: Awaited<ReturnType<typeof takeAttempt>>) {
  const { scope, keyHash, windowStart } = attempt
  const changed = await transaction.$executeRaw`
    UPDATE rate_limits SET hits = hits - 1
    WHERE scope = ${scope} AND key_hash = ${keyHash} AND window_start = ${windowStart} AND hits > 1
  `
  if (changed === 0) {
    // Lock the remaining reservation before deleting. A concurrent reservation can raise the count.
    const rows = await transaction.$queryRaw<{ hits: number }[]>`
      SELECT hits FROM rate_limits
      WHERE scope = ${scope} AND key_hash = ${keyHash} AND window_start = ${windowStart} FOR UPDATE
    `
    if (rows[0]?.hits === 1) {
      await transaction.rateLimit.delete({ where: { scope_keyHash_windowStart: { scope, keyHash, windowStart } } })
    } else if (rows.length) {
      await transaction.rateLimit.update({ where: { scope_keyHash_windowStart: { scope, keyHash, windowStart } }, data: { hits: { decrement: 1 } } })
    }
  }
}
