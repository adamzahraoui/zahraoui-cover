import type { Prisma } from '@prisma/client'
import type { Response } from 'express'
import { ApiError } from '../middleware/errors.js'
import { currentSession } from './auth/session.js'

export function staleRecord() {
  return new ApiError(409, 'STALE_VERSION', 'Le dossier a été modifié. Rechargez la fiche.')
}

export async function staffAudit(database: Prisma.TransactionClient, response: Response, targetType: string, targetId: string, action: string, metadata?: Prisma.InputJsonValue) {
  await database.auditEvent.create({
    data: { actorId: currentSession(response).user.id, requestId: response.locals.requestId, targetType, targetId, action, metadata },
  })
}

export function recordHistory(database: Prisma.TransactionClient, targetType: string, targetId: string) {
  return database.auditEvent.findMany({
    where: { targetType, targetId, action: { not: 'RECORD_VIEWED' } }, take: 20,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, action: true, createdAt: true, actor: { select: { displayName: true } } },
  })
}

export async function lockActiveClient(database: Prisma.TransactionClient, id: string) {
  const [client] = await database.$queryRaw<{ id: string; provisional: boolean }[]>`
    SELECT id, intake_provisional AS provisional FROM clients WHERE id = ${id}::uuid AND archived_at IS NULL FOR SHARE
  `
  if (!client) throw new ApiError(422, 'VALIDATION_FAILED', 'Client indisponible.', { clientId: 'Client indisponible.' })
  return client
}

export async function dateRange(database: Prisma.TransactionClient, from?: string, to?: string) {
  if (!from && !to) return undefined
  const [range] = await database.$queryRaw<{ start: Date | null; ending: Date | null }[]>`
    SELECT (${from ?? null}::date::timestamp AT TIME ZONE 'Africa/Casablanca') AS start,
      ((${to ?? null}::date + 1)::timestamp AT TIME ZONE 'Africa/Casablanca') AS ending
  `
  return { gte: range.start ?? undefined, lt: range.ending ?? undefined }
}
