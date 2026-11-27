import type { Partner, Prisma } from '@prisma/client'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { emailField } from '../auth/contracts.js'
import { fromProductSlug, phoneField, productSlug, toProductSlug } from '../business-inputs.js'
import type { PublicSlug } from '../business-inputs.js'

export const partnerWebsite = z.string().trim().max(300).url().refine(value => {
  try {
    const url = new URL(value)
    return value.startsWith('https://') && url.protocol === 'https:' && !url.username && !url.password && !/[\s\\]/.test(value)
  } catch { return false }
})
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional()

// Shared validation for interactive drafts and a future authorized importer.
export const partnerFields = z.strictObject({
  name: z.string().trim().min(2).max(120),
  displayName: optionalText(120), contactPerson: optionalText(120), phone: phoneField.nullable().optional(),
  email: emailField.nullable().optional(), website: partnerWebsite.nullable().optional(),
  address: optionalText(300), internalNotes: optionalText(2000),
  categories: z.array(productSlug).max(6).refine(items => new Set(items).size === items.length).optional(),
  logoKey: z.null().optional(),
})
export type PartnerFields = z.infer<typeof partnerFields>

export async function resolveCategories(db: Prisma.TransactionClient, categories: PublicSlug[]) {
  const slugs = categories.map(toProductSlug)
  const count = await db.insuranceProduct.count({ where: { slug: { in: slugs } } })
  if (count !== slugs.length) throw new ApiError(422, 'PARTNER_CATEGORIES', 'Sélectionnez des catégories enregistrées dans le catalogue.')
  return slugs
}

export async function createPartner(db: Prisma.TransactionClient, input: PartnerFields, legacyReference?: string) {
  const { categories = [], ...fields } = input
  return db.partner.create({ data: { ...fields, legacyReference, categories: await resolveCategories(db, categories), isActive: false, isPublished: false } })
}

export const eligiblePartner = { isActive: true, verifiedAt: { not: null } } satisfies Prisma.PartnerWhereInput

export async function lockEligiblePartner(db: Prisma.TransactionClient, partnerId: string, productId: string) {
  const [row] = await db.$queryRaw<{ name: string }[]>`
    SELECT p.name FROM partners p JOIN insurance_products i ON i.id=${productId}::uuid
    WHERE p.id=${partnerId}::uuid AND p.is_active AND p.verified_at IS NOT NULL
      AND i.slug=ANY(p.categories) FOR SHARE OF p
  `
  return row
}

export function partnerRow(row: Pick<Partner, 'id' | 'name' | 'displayName' | 'categories' | 'isActive' | 'isPublished' | 'verifiedAt' | 'version'>) {
  return { ...row, categories: row.categories.map(fromProductSlug) }
}
