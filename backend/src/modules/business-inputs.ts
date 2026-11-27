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
