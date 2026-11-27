import type { ImportKind, Prisma } from '@prisma/client'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { toProductSlug } from '../business-inputs.js'
import type { PublicSlug } from '../business-inputs.js'
import { clientFields, createClient, duplicates } from '../clients/model.js'
import { createExternalPolicy, externalPolicyInput } from '../contracts/external-policy.js'
import { onDate, validatePeriod } from '../contracts/model.js'
import { createPartner, partnerFields, resolveCategories } from '../partners/model.js'
import { checkMapping, fields } from './columns.js'
import type { Selection } from './columns.js'
import { fold } from './spreadsheets.js'
import type { Cell, Sheet } from './spreadsheets.js'

const legacyId = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}][\p{L}\p{N}.:_/ -]*$/u)
const categories: Record<string, PublicSlug> = {
  automobile: 'automobile', auto: 'automobile', habitation: 'habitation', sante: 'sante',
  voyage: 'voyage', professionnelle: 'professionnelle', professionnel: 'professionnelle',
  'responsabilite civile': 'responsabilite-civile', rc: 'responsabilite-civile',
}
const profiles: Record<string, 'INDIVIDUAL' | 'BUSINESS'> = {
  individual: 'INDIVIDUAL', particulier: 'INDIVIDUAL', business: 'BUSINESS', entreprise: 'BUSINESS', professionnel: 'BUSINESS',
}

type ParsedRecord =
  | { kind: 'CLIENTS'; input: z.infer<typeof clientFields>; legacy?: string }
  | { kind: 'PARTNERS'; input: z.infer<typeof partnerFields>; legacy?: string }
  | { kind: 'CONTRACTS'; input: z.infer<typeof externalPolicyInput>; legacy?: string }
class RowIssue extends Error {
  constructor(public code: string, public field?: string) { super(code) }
}

type Result = { line: number; state: 'VALID' | 'INVALID' | 'DUPLICATE'; code?: string; field?: string }

function fail(code: string, field?: string): never {
  throw new RowIssue(code, field)
}

function text(value: Cell | undefined) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : undefined
}

export function insuranceDate(cell: Cell | undefined, date1904: boolean) {
  if (cell instanceof Date) return Number.isFinite(cell.valueOf()) && cell.valueOf() % 86_400_000 === 0 ? cell.toISOString().slice(0, 10) : undefined
  if (typeof cell === 'number') {
    if (!Number.isInteger(cell) || cell < 0 || cell > 2_958_000 || (!date1904 && cell === 60)) return undefined
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, cell < 60 ? 31 : 30)
    return new Date(epoch + cell * 86_400_000).toISOString().slice(0, 10)
  }
  const value = text(cell)
  if (!value) return undefined
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (!match) return z.iso.date().safeParse(value).data
  if (Number(match[1]) <= 12 && Number(match[2]) <= 12 && Number(match[1]) !== Number(match[2])) return undefined
  return z.iso.date().safeParse(match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0')).data
}

function category(value: string) {
  const key = fold(value).replace(/^assurance /, '')
  return Object.hasOwn(categories, key) ? categories[key] : undefined
}

function parsed<T>(schema: z.ZodType<T>, input: object): T {
  const result = schema.safeParse(input)
  if (!result.success) fail('INVALID_FIELD', String(result.error.issues[0].path[0] ?? ''))
  return result.data
}

async function reference(db: Prisma.TransactionClient, kind: 'customer' | 'partner', value: string) {
  const id = z.uuid().safeParse(value).data
  const where = { OR: [{ legacyReference: value }, ...(id ? [{ id }] : [])] }
  const select = { id: true } as const
  const rows = kind === 'customer'
    ? await db.client.findMany({ where: { ...where, archivedAt: null }, select, take: 2 })
    : await db.partner.findMany({ where, select, take: 2 })
  if (rows.length !== 1) fail(rows.length ? 'AMBIGUOUS_RELATION' : 'UNRESOLVED_RELATION', kind)
  return rows[0].id
}

async function parseRecord(db: Prisma.TransactionClient, kind: ImportKind, sheet: Record<string, Cell>, date1904: boolean): Promise<ParsedRecord> {
  for (const field of fields[kind]) {
    if (field.required && (sheet[field.key] == null || sheet[field.key] === '')) fail('REQUIRED_FIELD', field.key)
  }
  const input = Object.fromEntries(Object.entries(sheet).map(([key, value]) => [key, text(value)]))
  if (sheet.legacyReference != null && sheet.legacyReference !== '' && !legacyId.safeParse(input.legacyReference).success) fail('INVALID_IDENTIFIER', 'legacyReference')
  const legacy = input.legacyReference || undefined
  for (const [key, value] of Object.entries(sheet)) {
    if (typeof value === 'string' && /^[\s\p{Cf}]*[=+\-@＝＋－＠]/u.test(value) && !(key === 'phone' && /^\+\d/.test(value.trim()))) {
      fail('FORMULA_TEXT', key)
    }
    if (typeof value === 'boolean') fail('INVALID_FIELD', key)
    if (value != null && value !== '' && (key === 'phone' || ['policyNumber', 'customer', 'partner'].includes(key)) && typeof value !== 'string') fail('TEXT_REQUIRED', key)
    if (typeof value === 'number' && !['effectiveOn', 'expiresOn', 'premiumMad'].includes(key)) fail('TEXT_REQUIRED', key)
    if (value instanceof Date && !['effectiveOn', 'expiresOn'].includes(key)) fail('INVALID_FIELD', key)
  }
  if (kind === 'CLIENTS') {
    const key = fold(input.profile ?? '')
    const profile = Object.hasOwn(profiles, key) ? profiles[key] : undefined
    if (!profile) fail('INVALID_FIELD', 'profile')
    const displayName = input.displayName || (profile === 'BUSINESS' ? input.company : input.lastName && [input.firstName, input.lastName].filter(Boolean).join(' '))
    if (!displayName) fail('REQUIRED_FIELD', profile === 'BUSINESS' ? 'company' : 'displayName')
    return { kind, legacy, input: parsed(clientFields, { profile, displayName, phone: input.phone, email: input.email || undefined, city: input.city || undefined }) }
  }
  if (kind === 'PARTNERS') {
    const values = input.categories ? input.categories.split(/[|,;]/).map(category) : []
    if (values.some(value => !value)) fail('INVALID_CATEGORY', 'categories')
    const record = parsed(partnerFields, {
      name: input.name, displayName: input.displayName || undefined, contactPerson: input.contactPerson || undefined,
      phone: input.phone || undefined, email: input.email || undefined, website: input.website || undefined,
      address: input.address || undefined, categories: values,
    })
    try { await resolveCategories(db, record.categories ?? []) }
    catch (error) {
      if (error instanceof ApiError) fail('INVALID_CATEGORY', 'categories')
      throw error
    }
    return { kind, legacy, input: record }
  }
  const productSlug = category(input.category ?? '')
  if (!productSlug) fail('INVALID_CATEGORY', 'category')
  const effectiveOn = insuranceDate(sheet.effectiveOn, date1904)
  const expiresOn = insuranceDate(sheet.expiresOn, date1904)
  if (!effectiveOn) fail('INVALID_DATE', 'effectiveOn')
  if (!expiresOn) fail('INVALID_DATE', 'expiresOn')
  try { validatePeriod(onDate(effectiveOn), onDate(expiresOn)) } catch { fail('INVALID_PERIOD', 'expiresOn') }
  const clientId = await reference(db, 'customer', input.customer ?? '')
  const partnerId = await reference(db, 'partner', input.partner ?? '')
  const product = await db.insuranceProduct.findUnique({ where: { slug: toProductSlug(productSlug) }, select: { id: true } })
  if (!product) fail('INVALID_CATEGORY', 'category')
  const partner = await db.partner.findFirst({
    where: { id: partnerId, isActive: true, verifiedAt: { not: null }, categories: { has: toProductSlug(productSlug) } }, select: { id: true },
  })
  if (!partner) fail('PARTNER_INELIGIBLE', 'partner')
  const money = typeof sheet.premiumMad === 'number' ? String(sheet.premiumMad) : input.premiumMad
  return { kind, legacy, input: parsed(externalPolicyInput, {
    clientId, partnerId, productSlug, policyNumber: input.policyNumber, effectiveOn, expiresOn,
    premiumMad: money?.replace(/\s*MAD$/i, '').replace(',', '.') || undefined, coverage: input.coverage || undefined, renewalReminders: false,
  }) }
}

function duplicateKeys(record: ParsedRecord) {
  const keys = record.legacy ? ['legacy:' + record.legacy] : []
  if (record.kind === 'CLIENTS') {
    keys.push('phone:' + record.input.phone)
    if (record.input.email) keys.push('email:' + record.input.email.toLowerCase())
  } else if (record.kind === 'PARTNERS') keys.push('name:' + record.input.name.toLowerCase())
  else keys.push('policy:' + record.input.partnerId + ':' + record.input.policyNumber)
  return keys
}

async function existingConflict(db: Prisma.TransactionClient, record: ParsedRecord) {
  const legacy = record.legacy
  if (record.kind === 'CLIENTS') {
    if (legacy && await db.client.count({ where: { legacyReference: legacy } })) return 'LEGACY_EXISTS'
    if ((await duplicates(db, record.input.phone, record.input.email)).length) return 'CUSTOMER_DUPLICATE'
  } else if (record.kind === 'PARTNERS') {
    if (legacy && await db.partner.count({ where: { legacyReference: legacy } })) return 'LEGACY_EXISTS'
    if (await db.partner.count({ where: { name: { equals: record.input.name, mode: 'insensitive' } } })) return 'PARTNER_DUPLICATE'
  } else {
    if (legacy && await db.contract.count({ where: { legacyReference: legacy } })) return 'LEGACY_EXISTS'
    if (await db.contract.count({ where: { partnerId: record.input.partnerId, policyNumber: record.input.policyNumber } })) return 'POLICY_DUPLICATE'
  }
}

export async function evaluate(db: Prisma.TransactionClient, kind: ImportKind, sheet: Sheet, selection: Selection, date1904: boolean) {
  checkMapping(kind, sheet.headers, selection.mapping)
  if (!sheet.rows.length) throw new ApiError(422, 'IMPORT_EMPTY', 'La feuille ne contient aucune ligne à importer.')
  const rows: Result[] = []
  const records: { line: number; record: ParsedRecord }[] = []
  const keys = new Map<string, number>()
  for (const row of sheet.rows) {
    const mapped = Object.fromEntries(selection.mapping.flatMap((field, index) => field ? [[field, row.cells[index] ?? null]] : []))
    try {
      const record = await parseRecord(db, kind, mapped, date1904)
      for (const key of duplicateKeys(record)) keys.set(key, (keys.get(key) ?? 0) + 1)
      records.push({ line: row.line, record })
    } catch (error) {
      if (!(error instanceof RowIssue)) throw error
      rows.push({ line: row.line, state: 'INVALID', code: error.code, ...(error.field ? { field: error.field } : {}) })
    }
  }
  const valid: typeof records = []
  for (const { line, record } of records) {
    const code = duplicateKeys(record).some(key => (keys.get(key) ?? 0) > 1) ? 'FILE_DUPLICATE' : await existingConflict(db, record)
    if (code) rows.push({ line, state: 'DUPLICATE', code })
    else {
      rows.push({ line, state: 'VALID' })
      valid.push({ line, record })
    }
  }
  rows.sort((a, b) => a.line - b.line)
  const counts = { total: rows.length, valid: valid.length, rejected: rows.filter(row => row.state === 'INVALID').length, skipped: rows.filter(row => row.state === 'DUPLICATE').length, created: 0 }
  return { rows, valid, counts }
}

export async function saveRecord(db: Prisma.TransactionClient, record: ParsedRecord, author: string) {
  switch (record.kind) {
    case 'CLIENTS': return createClient(db, record.input, false, { legacyReference: record.legacy })
    case 'PARTNERS': return createPartner(db, record.input, record.legacy)
    case 'CONTRACTS': return createExternalPolicy(db, record.input, author, record.legacy)
  }
}
