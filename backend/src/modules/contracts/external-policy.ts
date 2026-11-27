import { randomBytes } from 'node:crypto'
import type { Contract, Prisma } from '@prisma/client'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { productSlug, toProductSlug } from '../business-inputs.js'
import { lockEligiblePartner } from '../partners/model.js'
import { lockActiveClient } from '../staff-records.js'
import { contractConflict, onDate, policyFields, validatePeriod } from './model.js'

export const externalPolicyInput = z.strictObject({ ...policyFields, clientId: z.uuid(), partnerId: z.uuid(), productSlug })

export function reference() {
  return 'CTR-' + randomBytes(12).toString('hex').toUpperCase()
}
export async function validateLinks(db: Prisma.TransactionClient, input: Pick<Contract, 'clientId' | 'partnerId' | 'productId'>, verified = false) {
  const client = await lockActiveClient(db, input.clientId)
  if (verified && client.provisional) throw contractConflict('Vérifiez l’identité du client avant l’activation.')
  const provider = await lockEligiblePartner(db, input.partnerId, input.productId)
  if (!provider) throw contractConflict('La compagnie doit être vérifiée et active pour cette assurance.')
  return provider
}

export function draftValues(input: Partial<z.infer<typeof externalPolicyInput>>, existing?: Contract) {
  const effectiveOn = input.effectiveOn ? onDate(input.effectiveOn) : existing?.effectiveOn
  const expiresOn = input.expiresOn ? onDate(input.expiresOn) : existing?.expiresOn
  if (!effectiveOn || !expiresOn) throw new ApiError(422, 'CONTRACT_DATES', 'Les deux dates sont obligatoires.')
  validatePeriod(effectiveOn, expiresOn)
  return {
    effectiveOn, expiresOn, policyNumber: input.policyNumber, coverage: input.coverage, premiumMad: input.premiumMad,
    internalNotes: input.internalNotes, renewalReminders: input.renewalReminders,
  }
}

export async function createExternalPolicy(db: Prisma.TransactionClient, input: z.infer<typeof externalPolicyInput>,
  author: string, legacyReference?: string) {
  const product = await db.insuranceProduct.findUnique({ where: { slug: toProductSlug(input.productSlug) }, select: { id: true } })
  if (!product) throw contractConflict('Assurance introuvable.')
  await validateLinks(db, { ...input, productId: product.id })
  return db.contract.create({ data: {
    ...draftValues(input), clientId: input.clientId, partnerId: input.partnerId, productId: product.id,
    reference: reference(), createdBy: author, legacyReference,
  } })
}
