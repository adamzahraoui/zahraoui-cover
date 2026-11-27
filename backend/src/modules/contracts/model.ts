import { Prisma } from '@prisma/client'
import type { ContractStatus } from '@prisma/client'
import { z } from 'zod'
import { casablancaDate, fromProductSlug } from '../business-inputs.js'
import { ApiError } from '../../middleware/errors.js'

export const contractFilter = z.enum(['DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'CANCELLED', 'UNVERIFIED'])
export const policyFields = {
  policyNumber: z.string().trim().min(2).max(64).nullable().optional(),
  effectiveOn: z.iso.date(), expiresOn: z.iso.date(),
  coverage: z.string().trim().min(3).max(3000).nullable().optional(),
  premiumMad: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).transform(value => new Prisma.Decimal(value)).refine(value => value.gt(0)).nullable().optional(),
  internalNotes: z.string().trim().max(2000).nullable().optional(),
  renewalReminders: z.boolean().optional(),
}

export const contractRowSelect = {
  id: true, clientId: true, quoteId: true, partnerId: true, reference: true, policyNumber: true, version: true,
  previousId: true, status: true, effectiveOn: true, expiresOn: true, confirmationOn: true, activatedAt: true, createdAt: true,
  premiumMad: true, currency: true, renewalReminders: true, activationSnapshot: true, sourceQuoteSnapshot: true,
  client: { select: { displayName: true } },
  quote: { select: { reference: true } },
  product: { select: { slug: true, title: true } },
  partner: { select: { name: true } },
  successors: { where: { OR: [{ status: { not: 'CANCELLED' } }, { activatedAt: { not: null } }] },
    take: 1, select: { id: true, activatedAt: true, reference: true } },
} satisfies Prisma.ContractSelect

export function onDate(value: string) {
  return new Date(value + 'T00:00:00.000Z')
}

export function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number) {
  const value = onDate(day)
  value.setUTCDate(value.getUTCDate() + days)
  return dateOnly(value)
}

export function coverageStatus(row: { status: ContractStatus; effectiveOn: Date; expiresOn: Date; confirmationOn: Date | null }, today = casablancaDate()) {
  if (row.status !== 'ACTIVE') return row.status
  if (dateOnly(row.expiresOn) <= today) return 'EXPIRED'
  if (!row.confirmationOn) return 'UNVERIFIED'
  return dateOnly(row.effectiveOn) > today ? 'SCHEDULED' : 'ACTIVE'
}

export function contractRow(row: Prisma.ContractGetPayload<{ select: typeof contractRowSelect }>) {
  const status = coverageStatus(row)
  const successor = row.successors[0]
  const snapshot = row.activationSnapshot ?? row.sourceQuoteSnapshot
  const frozenCarrier = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && typeof snapshot.carrier === 'string' ? snapshot.carrier : undefined
  return {
    id: row.id, clientId: row.clientId, quoteId: row.quoteId, quoteReference: row.quote?.reference ?? null,
    partnerId: row.partnerId, partnerName: frozenCarrier ?? row.partner.name, clientName: row.client.displayName,
    productSlug: fromProductSlug(row.product.slug), productTitle: row.product.title, reference: row.reference, policyNumber: row.policyNumber,
    version: row.version, status, effectiveOn: dateOnly(row.effectiveOn), expiresOn: dateOnly(row.expiresOn),
    premiumMad: row.premiumMad?.toFixed(2) ?? null, currency: row.currency, createdAt: row.createdAt,
    previousId: row.previousId, successorId: successor?.id ?? null, successorReference: successor?.reference ?? null,
    renewed: Boolean(successor?.activatedAt), renewalReminders: row.renewalReminders, confirmed: Boolean(row.confirmationOn),
  }
}

export function validatePeriod(start: Date, end: Date) {
  if (end <= start) throw new ApiError(422, 'CONTRACT_DATES', 'L’échéance doit être postérieure à la date d’effet.')
}

export function contractConflict(message: string) {
  return new ApiError(409, 'CONTRACT_STATE', message)
}

export async function lockContract(db: Prisma.TransactionClient, id: string) {
  const [row] = await db.$queryRaw<{ id: string }[]>`SELECT id FROM contracts WHERE id=${id}::uuid FOR UPDATE`
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Contrat introuvable.')
}
