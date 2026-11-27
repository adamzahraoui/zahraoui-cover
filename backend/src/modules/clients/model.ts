import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { emailField } from '../auth/contracts.js'
import { phoneField, profile } from '../business-inputs.js'

export const clientFields = z.strictObject({
  profile, displayName: z.string().trim().min(2).max(120), phone: phoneField,
  email: emailField.nullable().optional(), city: z.string().trim().min(2).max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})
export async function duplicates(database: Prisma.TransactionClient, phone?: string, email?: string | null, id?: string, locked = false) {
  const fields: Prisma.ClientWhereInput[] = []
  if (phone) fields.push({ phone })
  if (email) fields.push({ email: { equals: email, mode: 'insensitive' } })
  if (!fields.length) return []
  if (locked) {
    const keys = [phone && 'phone:' + phone, email && 'email:' + email].filter(Boolean).sort()
    for (const key of keys) await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'client:' + key}, 0))`
  }
  return database.client.findMany({
    where: { id: id ? { not: id } : undefined, OR: fields }, take: 10,
    select: { id: true, displayName: true, intakeProvisional: true, archivedAt: true },
    orderBy: [{ archivedAt: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
  })
}

export async function createClient(db: Prisma.TransactionClient, input: z.infer<typeof clientFields>, allowDuplicate: boolean,
  imported?: { legacyReference?: string }) {
  if ((await duplicates(db, input.phone, input.email, undefined, true)).length && !allowDuplicate) {
    throw new ApiError(409, 'CLIENT_DUPLICATES', 'Des fiches utilisent ces coordonnées. Vérifiez les correspondances.')
  }
  return db.client.create({ data: { ...input, legacyReference: imported?.legacyReference, intakeProvisional: imported ? true : undefined } })
}
