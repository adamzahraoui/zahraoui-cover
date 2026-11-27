import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { expireImports } from '../src/modules/imports/routes.js'
import { mime, readSpreadsheet, writeSpreadsheet } from '../src/modules/imports/spreadsheets.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use a dedicated local _test database.')
const url = new URL(databaseUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || databaseUrl === process.env.PRODUCTION_DATABASE_URL) throw new Error('Test database required.')

const db = connectPrisma(databaseUrl)
const config = loadConfig({ ...process.env, DATABASE_URL: databaseUrl, RATE_KEY_SECRET: randomBytes(32).toString('hex') })
const token = randomUUID().slice(0, 8)
const clientLegacy = '000CLIENT-' + token
const partnerLegacy = '000CIE-' + token
const policyLegacy = '000POL-' + token
const phonePrefix = '06' + String(Number.parseInt(token.slice(0, 6), 16)).padStart(8, '0').slice(0, 6)
let origin: string
let close: () => Promise<void>
let admin: Record<string, string>
let otherAdmin: Record<string, string>
let advisor: Record<string, string>
let customerId: string
let partnerId: string

type Kind = 'CLIENTS' | 'PARTNERS' | 'CONTRACTS'
type Job = {
  id: string; version: number; status: string; previouslyImported?: boolean; counts: { valid: number; rejected: number; skipped: number; created: number }
  diagnostics: { line: number; code?: string }[] | null
  sheets: { suggested: (string | null)[] }[]
  createdRecords: { id: string }[]
}

function call(path: string, credentials: Record<string, string> = admin, init: RequestInit = {}, extra: Record<string, string> = {}) {
  return fetch(origin + '/api' + path, { ...init, headers: { Origin: config.PUBLIC_ORIGIN, ...credentials, ...extra } })
}
async function payload<T = Job>(response: Response, status = 200) {
  assert.equal(response.status, status, await response.clone().text())
  return (await response.json() as { data: T }).data
}
function action(path: string, body: object, credentials = admin) {
  return call(path, credentials, { method: 'POST', body: JSON.stringify(body) }, { 'Content-Type': 'application/json' })
}
async function signIn(role: 'ADVISOR' | 'ADMIN') {
  const email = randomUUID() + '@example.invalid'
  const password = randomToken()
  await db.staffUser.create({ data: { role, email, displayName: 'Vérification des imports', passwordHash: await hashPassword(password) } })
  const session = await action('/auth/login', { email, password }, {})
  const { csrfToken } = await payload<{ csrfToken: string }>(session)
  return { Cookie: (session.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': csrfToken }
}
function upload(bytes: Buffer, kind: Kind, format: 'csv' | 'xlsx' = 'csv', credentials = admin, filename = 'synthetique.' + format) {
  return call('/admin/imports?kind=' + kind + '&format=' + format, credentials, { method: 'POST', body: new Uint8Array(bytes) },
    { 'Content-Type': mime[format], 'X-Import-Filename': encodeURIComponent(filename) })
}
function validate(job: Job, bytes: Buffer, format: 'csv' | 'xlsx' = 'csv', mapping = job.sheets[0].suggested) {
  return call('/admin/imports/' + job.id + '/validate?version=' + job.version, admin, { method: 'POST', body: new Uint8Array(bytes) },
    { 'Content-Type': mime[format], 'X-Import-Selection': encodeURIComponent(JSON.stringify({ sheet: 0, mapping })) })
}
function confirm(job: Job, bytes: Buffer, format: 'csv' | 'xlsx' = 'csv', acknowledged = true) {
  return call('/admin/imports/' + job.id + '/confirm?version=' + job.version + (acknowledged ? '&confirmed=true' : ''),
    admin, { method: 'POST', body: new Uint8Array(bytes) }, { 'Content-Type': mime[format] })
}
const clients = (rows: string) => Buffer.from('Profil;Nom complet;Téléphone;Email;Référence historique\n' + rows)
const policies = (customer: string, partner: string, legacy: string) =>
  Buffer.from('Numéro de police;Référence historique;Référence client;Référence compagnie;Catégorie;Date d’effet;Date d’échéance;Prime MAD\n' +
    '00' + legacy + ';' + legacy + ';' + customer + ';' + partner + ';Automobile;27/11/2026;2027-12-01;1420,95 MAD\n')

before(async () => {
  await db.$connect()
  const server = (await createApp(db, config)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  admin = await signIn('ADMIN')
  otherAdmin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  await db.insuranceProduct.upsert({ where: { slug: 'automobile' }, update: {}, create: {
    slug: 'automobile', title: 'Automobile', summary: 'Catégorie de test.', audiences: ['INDIVIDUAL'],
    potentialCoverages: [], eligibilityText: '', documentHints: [], faqs: [], relatedSlugs: [],
  } })
})

after(async () => {
  await close?.()
  await db.$disconnect()
})

test('templates, uploads, history and exports enforce staff role and CSRF', async () => {
  assert.equal((await call('/admin/imports', {})).status, 401)
  assert.equal((await call('/admin/imports', advisor)).status, 403)
  assert.equal((await call('/admin/imports/templates/CLIENTS', advisor)).status, 403)
  assert.equal((await call('/admin/exports/CLIENTS', advisor)).status, 403)
  assert.equal((await call('/admin/exports/CLIENTS', {})).status, 401)
  const response = await call('/admin/imports/templates/CLIENTS')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual((await readSpreadsheet(Buffer.from(await response.arrayBuffer()), 'xlsx')).sheets[0].headers.slice(0, 2), ['Profil', 'Nom complet'])
  assert.equal((await upload(clients(''), 'CLIENTS', 'csv', { Cookie: admin.Cookie })).status, 403)
  assert.equal((await upload(clients(''), 'CLIENTS', 'csv', admin, 'test.xlsm')).status, 422)
})

test('dry run rejects invalid rows without business writes and protects job history', async () => {
  const bytes = clients('Particulier;Élise ' + token + ';' + phonePrefix + '10;;' + clientLegacy + '\nParticulier;Sans téléphone;;;;\n'.replace(';;;;', ';;;'))
  const start = await payload(await upload(bytes, 'CLIENTS'), 201)
  assert.equal((await call('/admin/imports/' + start.id, otherAdmin)).status, 404)
  assert.equal((await validate(start, Buffer.concat([bytes, Buffer.from('\n')]))).status, 409)
  const valid = await payload(await validate(start, bytes))
  assert.equal(valid.counts.valid, 1)
  assert.equal(valid.counts.rejected, 1)
  assert.equal(valid.diagnostics?.find(row => row.line === 3)?.code, 'REQUIRED_FIELD')
  assert.equal(await db.client.count({ where: { legacyReference: clientLegacy } }), 0)
  assert.equal((await confirm(valid, bytes)).status, 409)
  const report = await call('/admin/imports/' + start.id + '/errors')
  assert.equal(report.status, 200)
  const text = await report.text()
  assert.match(text, /REQUIRED_FIELD/)
  assert.doesNotMatch(text, /Élise|Sans téléphone/)
})

test('confirmed XLSX creates a provisional customer exactly once and reports file and reference duplicates', async () => {
  const bytes = await writeSpreadsheet('xlsx', ['Profil', 'Nom complet', 'Téléphone', 'Email', 'Référence historique'],
    [['Particulier', 'Élise ' + token, phonePrefix + '10', 'synthetic-' + token + '@example.invalid', clientLegacy]], 'Clients')
  const start = await payload(await upload(bytes, 'CLIENTS', 'xlsx'), 201)
  const preview = await payload(await validate(start, bytes, 'xlsx'))
  assert.equal(preview.counts.valid, 1)
  assert.equal((await confirm(preview, bytes, 'xlsx', false)).status, 400)
  const [first, second] = await Promise.all([confirm(preview, bytes, 'xlsx'), confirm(preview, bytes, 'xlsx')])
  const created = await payload(first)
  assert.deepEqual((await payload(second)).createdRecords, created.createdRecords)
  customerId = created.createdRecords[0].id
  const customer = await db.client.findUniqueOrThrow({ where: { id: customerId } })
  assert.ok(customer.intakeProvisional)
  assert.equal(customer.legacyReference, clientLegacy)
  assert.equal(customer.phone, '+212' + (phonePrefix + '10').slice(1))
  const again = await payload(await upload(bytes, 'CLIENTS', 'xlsx'), 201)
  assert.ok(again.previouslyImported)
  const duplicate = await payload(await validate(again, bytes, 'xlsx'))
  assert.equal(duplicate.counts.skipped, 1)
  assert.equal(duplicate.diagnostics?.[0].code, 'LEGACY_EXISTS')
  assert.equal((await payload(await confirm(duplicate, bytes, 'xlsx'))).counts.created, 0)
})

test('a concurrent import cannot use a stale duplicate review', async () => {
  const one = clients('Particulier;Personne A;' + phonePrefix + '20;;A-' + token + '\n')
  const two = clients('Particulier;Personne B;' + phonePrefix + '20;;B-' + token + '\n')
  const a = await payload(await validate(await payload(await upload(one, 'CLIENTS'), 201), one))
  const b = await payload(await validate(await payload(await upload(two, 'CLIENTS'), 201), two))
  const result = await Promise.all([confirm(a, one), confirm(b, two)])
  assert.deepEqual(result.map(value => value.status).sort(), [200, 409])
  assert.equal(await db.client.count({ where: { phone: '+212' + (phonePrefix + '20').slice(1) } }), 1)
  assert.match(await result.find(value => value.status === 409)!.text(), /IMPORT_REVIEW_CHANGED/)
  const duplicates = clients('Particulier;Personne C;' + phonePrefix + '21;;C-' + token + '\nParticulier;Personne D;' + phonePrefix + '21;;D-' + token)
  const checked = await payload(await validate(await payload(await upload(duplicates, 'CLIENTS'), 201), duplicates))
  assert.equal(checked.counts.skipped, 2)
})

test('partner import never approves a partner and contract drafts require an unambiguous eligible link', async () => {
  const bytes = Buffer.from('Raison sociale;Catégories;Référence historique\nCompagnie synthétique ' + token + ';Automobile;' + partnerLegacy)
  const draft = await payload(await validate(await payload(await upload(bytes, 'PARTNERS'), 201), bytes))
  const applied = await payload(await confirm(draft, bytes))
  partnerId = applied.createdRecords[0].id
  const partner = await db.partner.findUniqueOrThrow({ where: { id: partnerId } })
  assert.equal(partner.verifiedAt, null)
  assert.equal(partner.isActive, false)
  assert.equal(partner.isPublished, false)
  const data = policies(clientLegacy, partnerLegacy, policyLegacy)
  const pre = await payload(await upload(data, 'CONTRACTS'), 201)
  assert.equal((await payload(await validate(pre, data))).diagnostics?.[0].code, 'PARTNER_INELIGIBLE')
  const verified = await payload<{ version: number }>(await action('/admin/partners/' + partnerId + '/verify', { reference: 'Vérification synthétique', version: partner.version }))
  await payload(await call('/admin/partners/' + partnerId, admin, { method: 'PATCH', body: JSON.stringify({ version: verified.version, isActive: true }) }, { 'Content-Type': 'application/json' }))
  const ambiguous = await db.client.create({ data: { legacyReference: customerId, profile: 'INDIVIDUAL', displayName: 'Homonyme synthétique', phone: '+212612445588' } })
  const ambiguousBytes = policies(customerId, partnerLegacy, 'AMBIG-' + token)
  const rejected = await payload(await validate(await payload(await upload(ambiguousBytes, 'CONTRACTS'), 201), ambiguousBytes))
  assert.equal(rejected.diagnostics?.[0].code, 'AMBIGUOUS_RELATION')
  assert.ok(ambiguous.id)
  const preview = await payload(await validate(await payload(await upload(data, 'CONTRACTS'), 201), data))
  const complete = await payload(await confirm(preview, data))
  const policy = await db.contract.findUniqueOrThrow({ where: { id: complete.createdRecords[0].id } })
  assert.equal(policy.clientId, customerId)
  assert.equal(policy.partnerId, partnerId)
  assert.equal(policy.status, 'DRAFT')
  assert.equal(policy.quoteId, null)
  assert.equal(policy.premiumMad?.toFixed(2), '1420.95')
  assert.equal(policy.renewalReminders, false)
  assert.equal(await db.outboxJob.count({ where: { contractId: policy.id } }), 0)
})

test('confirmation rolls back every business record if one insert fails', async () => {
  const data = clients('Particulier;Précède;' + phonePrefix + '46;;ROLL1-' + token + '\nParticulier;Déclenche échec B12;' + phonePrefix + '47;;ROLL2-' + token)
  const preview = await payload(await validate(await payload(await upload(data, 'CLIENTS'), 201), data))
  await db.$executeRaw`ALTER TABLE clients ADD CONSTRAINT import_test_rollback CHECK (display_name <> 'Déclenche échec B12')`
  try {
    const failure = await confirm(preview, data)
    assert.equal(failure.status, 503)
    assert.match(await failure.text(), /IMPORT_UNAVAILABLE/)
  }
  finally { await db.$executeRaw`ALTER TABLE clients DROP CONSTRAINT import_test_rollback` }
  assert.equal(await db.client.count({ where: { legacyReference: { in: ['ROLL1-' + token, 'ROLL2-' + token] } } }), 0)
  assert.equal((await payload(await call('/admin/imports/' + preview.id))).status, 'VALIDATED')
})

test('filtered export protects text and audits access, history persists and transient previews expire', async () => {
  await db.client.create({ data: { profile: 'INDIVIDUAL', displayName: '=EXEMPLE-' + token, phone: '+212610994411' } })
  const csv = await call('/admin/exports/CLIENTS?format=csv&q=' + encodeURIComponent('=EXEMPLE-' + token))
  assert.equal(csv.status, 200)
  assert.ok(csv.headers.get('x-exported-at'))
  assert.match(await csv.text(), /"'=EXEMPLE-/)
  const xlsx = await call('/admin/exports/CONTRACTS?format=xlsx&status=DRAFT&q=00' + policyLegacy)
  assert.equal(xlsx.status, 200)
  const sheet = (await readSpreadsheet(Buffer.from(await xlsx.arrayBuffer()), 'xlsx')).sheets[0]
  assert.equal(sheet.rows.length, 1)
  assert.ok(sheet.rows[0].cells.includes('1420.95'))
  assert.equal((await call('/admin/exports/ISSUED_QUOTES?archived=true')).status, 400)
  assert.equal(await db.auditEvent.count({ where: { action: 'SPREADSHEET_EXPORTED' } }), 2)
  const history = await call('/admin/imports?kind=CONTRACTS')
  assert.equal(history.status, 200)
  assert.ok((await history.json() as { data: Job[] }).data.some(job => job.status === 'COMPLETED'))
  const bytes = clients('Particulier;Expiré;' + phonePrefix + '54;;')
  const expired = await payload(await validate(await payload(await upload(bytes, 'CLIENTS'), 201), bytes))
  await db.importJob.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } })
  await expireImports(db)
  const status = await payload(await call('/admin/imports/' + expired.id))
  assert.equal(status.status, 'EXPIRED')
  assert.equal(status.diagnostics, null)
  assert.equal((await confirm(expired, bytes)).status, 410)
  const saved = await db.auditEvent.findFirst({ where: { targetId: customerId, action: 'RECORD_IMPORTED' } })
  assert.ok(saved)
})

test('production blocks real imports while authenticated filtered exports remain available', async () => {
  const server = (await createApp(db, { ...config, NODE_ENV: 'production' })).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const developmentOrigin = origin
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  try {
    const bytes = clients('Particulier;Test;' + phonePrefix + '88;;')
    assert.equal((await upload(bytes, 'CLIENTS')).status, 503)
    assert.equal((await call('/admin/exports/QUOTE_REQUESTS?format=csv')).status, 200)
    const history = await call('/admin/imports')
    assert.equal((await history.json() as { importEnabled: boolean }).importEnabled, false)
  } finally {
    origin = developmentOrigin
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
