import { randomUUID } from 'node:crypto'
import type { JobKind, PrismaClient } from '@prisma/client'

export const maxAttempts = 5

export async function claimJob(database: PrismaClient, kinds: JobKind[], quotePdfOnly = false) {
  const now = new Date()
  const leaseToken = randomUUID()
  const leaseUntil = new Date(now.getTime() + 90_000)
  const [claimed] = await database.$queryRaw<{ id: string }[]>`
    WITH next_job AS (
      SELECT job.id FROM outbox_jobs AS job
      WHERE kind::text = ANY(${kinds}::text[]) AND attempt_count < ${maxAttempts}
        AND ((state = 'PENDING' AND next_attempt_at <= ${now}) OR (state = 'RUNNING' AND lease_until <= ${now}))
        AND (NOT ${quotePdfOnly} OR EXISTS (SELECT 1 FROM documents WHERE id = job.document_id AND kind = 'QUOTE_PDF' AND quote_version IS NOT NULL))
      ORDER BY next_attempt_at, job.id
      LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_jobs AS job SET
      state = 'RUNNING', lease_until = ${leaseUntil}, lease_token = ${leaseToken}::uuid,
      attempt_count = attempt_count + 1
    FROM next_job WHERE job.id = next_job.id
    RETURNING job.id
  `
  return claimed ? { id: claimed.id, leaseToken } : undefined
}

export function retryTime(attempt: number) {
  return new Date(Date.now() + 15_000 * 2 ** (attempt - 1))
}
