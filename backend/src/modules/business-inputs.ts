import { z } from 'zod'
import { ApiError } from '../middleware/errors.js'

export const productSlug = z.enum(['automobile', 'habitation', 'sante', 'voyage', 'professionnelle', 'responsabilite-civile'])
export type PublicSlug = z.infer<typeof productSlug>
export const toProductSlug = (slug: PublicSlug) => slug === 'responsabilite-civile' ? 'responsabilite_civile' as const : slug
export const fromProductSlug = (slug: ReturnType<typeof toProductSlug>): PublicSlug => slug === 'responsabilite_civile' ? 'responsabilite-civile' : slug
export const profile = z.enum(['INDIVIDUAL', 'BUSINESS'])
export const versionField = z.number().int().positive().max(2147483647)
export const pagination = {
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(10_000)).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  q: z.string().trim().min(2).max(100).optional(),
}

export function parseQuery<T>(schema: z.ZodType<T>, input: unknown): T {
  const validated = schema.safeParse(input)
  if (!validated.success) throw new ApiError(400, 'MALFORMED_REQUEST', 'Paramètres invalides.')
  return validated.data
}

export function searchPrefix(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

export function casablancaDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function pageBounds({ page = 1, limit = 20 }: { page?: number; limit?: number }) {
  return { page, limit, skip: (page - 1) * limit }
}

export function normalizePhone(value: string) {
  const phone = value.replace(/[\s().-]/g, '')
  if (/^0[5-7]\d{8}$/.test(phone)) return '+212' + phone.slice(1)
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : undefined
}

export const phoneField = z.string().trim().max(32).transform((value, ctx) => {
  const phone = normalizePhone(value)
  if (phone) return phone
  ctx.addIssue({ code: 'custom', message: 'Numéro invalide.' })
  return z.NEVER
})

export const noteBody = z.strictObject({ version: versionField, body: z.string().trim().min(1).max(1000) })
