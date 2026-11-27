import type { Prisma } from '@prisma/client'

export function audit(
  database: Pick<Prisma.TransactionClient, 'auditEvent'>,
  action: string,
  requestId?: string,
  actorId?: string,
  outcome = 'SUCCESS',
) {
  return database.auditEvent.create({ data: { action, requestId, actorId, metadata: { outcome } } })
}
