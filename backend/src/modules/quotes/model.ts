import { Prisma } from '@prisma/client'
import type { QuoteStatus } from '@prisma/client'
import { z } from 'zod'
import { casablancaDate, fromProductSlug, productSlug } from '../business-inputs.js'
import { ApiError } from '../../middleware/errors.js'

const maximum = new Prisma.Decimal('9999999999.99')
const amount = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).transform(value => new Prisma.Decimal(value))
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const quoteStatus = z.enum(['DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'])
export const decisionMethod = z.enum(['EMAIL', 'PHONE', 'IN_PERSON', 'LETTER'])
export const offerFields = {
  annualPremiumMad: amount.refine(value => value.gt(0)),
  feesMad: amount.optional(),
  taxesMad: amount.optional(),
  coverage: optionalText(3000), coverageLimits: optionalText(2000), deductibles: optionalText(2000),
  conditions: optionalText(2000), internalNotes: optionalText(2000), customerNotes: optionalText(2000),
  validUntil: z.iso.date().nullable().optional(),
}
export const quoteInput = z.strictObject({
  clientId: z.uuid(), requestId: z.uuid().nullable().optional(), productSlug, partnerId: z.uuid(),
  ...offerFields,
})

export const quoteRowSelect = {
  id: true, reference: true, clientId: true, requestId: true, partnerId: true, version: true,
  revision: true, status: true, annualPremiumMad: true, totalMad: true, currency: true, createdAt: true,
  validUntil: true, issuedAt: true, sentAt: true, issuedSnapshot: true,
  client: { select: { displayName: true } },
  product: { select: { slug: true, title: true } },
  partner: { select: { name: true } },
} satisfies Prisma.QuoteSelect

export function calculateTotal(premium: Prisma.Decimal, fees: Prisma.Decimal, taxes: Prisma.Decimal) {
  const total = premium.plus(fees).plus(taxes)
  if (total.gt(maximum)) throw new ApiError(422, 'PRICE_OUT_OF_RANGE', 'Le total dépasse le montant autorisé.')
  return total
}

export function effectiveStatus(status: QuoteStatus, validUntil: Date | null, today = casablancaDate()): QuoteStatus {
  if ((status === 'ISSUED' || status === 'SENT') && validUntil && validUntil.toISOString().slice(0, 10) < today) return 'EXPIRED'
  return status
}

export function quoteRow(row: Prisma.QuoteGetPayload<{ select: typeof quoteRowSelect }>) {
  const issued = row.issuedSnapshot
  const frozenCarrier = issued && typeof issued === 'object' && !Array.isArray(issued) && typeof issued.carrier === 'string' ? issued.carrier : undefined
  return {
    id: row.id, reference: row.reference, clientId: row.clientId, requestId: row.requestId, partnerId: row.partnerId,
    clientName: row.client.displayName, productSlug: fromProductSlug(row.product.slug), productTitle: row.product.title, partnerName: frozenCarrier ?? row.partner.name,
    status: effectiveStatus(row.status, row.validUntil), version: row.version, revision: row.revision,
    annualPremiumMad: row.annualPremiumMad.toFixed(2), totalMad: (row.totalMad ?? row.annualPremiumMad).toFixed(2), currency: row.currency,
    createdAt: row.createdAt, issuedAt: row.issuedAt, sentAt: row.sentAt, validUntil: row.validUntil?.toISOString().slice(0, 10) ?? null,
  }
}

export const snapshotSchema = z.strictObject({
  reference: z.string(), revision: z.number(), issuedOn: z.iso.date(), validUntil: z.iso.date(),
  clientName: z.string(), city: z.string().nullable(), email: z.string().nullable(), product: z.string(), carrier: z.string(),
  coverage: z.string(), limits: z.string(), deductibles: z.string().nullable(), conditions: z.string(),
  customerNotes: z.string().nullable(), premium: z.string(), fees: z.string(), taxes: z.string(), total: z.string(),
  development: z.literal(true),
})
export type QuoteSnapshot = z.infer<typeof snapshotSchema>

export const pdfJobKey = (id: string) => 'quote-pdf:' + id
export const deliveryJobKey = (id: string) => 'quote-delivery:' + id

export async function lockLinkedRequest(db: Prisma.TransactionClient, id: string | null) {
  if (!id) return null
  const [request] = await db.$queryRaw<{ id: string; status: string; clientId: string | null; productId: string }[]>`
    SELECT id, status, client_id AS "clientId", product_id AS "productId" FROM quote_requests WHERE id = ${id}::uuid FOR UPDATE
  `
  return request ?? null
}

