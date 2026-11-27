import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { chmod, mkdtemp, readdir, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import PDFDocument from 'pdfkit'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { casablancaDate } from '../src/modules/business-inputs.js'
import { addDays, onDate } from '../src/modules/contracts/model.js'
import { pdfDigest } from '../src/modules/quotes/files.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must use a dedicated local _test database.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) throw new Error('Test database required.')
const folder = await mkdtemp(join(tmpdir(), 'zc-documents-'))
const config = loadConfig({ ...process.env, DATABASE_URL: testUrl, QUOTE_PDF_DIR: folder, RATE_KEY_SECRET: randomBytes(32).toString('hex') })
const db = connectPrisma(testUrl)
const unique = randomUUID().slice(0, 8)
const quoteReference = 'DV-DOC-' + unique
const contractReference = 'CTR-DOC-' + unique
const today = casablancaDate()
let origin: string
let stop: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let quoteId: string
let quoteDocumentId: string
let contractId: string
let clientId: string
let version = 1
let support: DocumentResult
let policy: DocumentResult
let quoteBytes: Buffer
let uploadBytes: Buffer

type DocumentResult = {
  id: string; name: string; kind: string; version: number; revision: number; quoteVersion: number | null; archivedAt: string | null
  sizeBytes: string; canPreview: boolean; canArchive: boolean; client: { id: string }; activity: { action: string }[]
}
type DocumentPage = { data: DocumentResult[]; meta: { total: number }; storage: { count: number; sizeBytes: string } }

function syntheticPdf(label: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const writer = new PDFDocument()
    const parts: Buffer[] = []
    writer.on('data', chunk => parts.push(chunk))
    writer.on('end', () => resolve(Buffer.concat(parts)))
    writer.on('error', reject)
    writer.text('DOCUMENT SYNTHÉTIQUE DE VÉRIFICATION · ' + label)
    writer.end()
  })
}

function request(path: string, headers: Record<string, string> = advisor, init: RequestInit = {}) {
  return fetch(origin + '/api' + path, { ...init, headers: { Origin: config.PUBLIC_ORIGIN, ...headers } })
}

async function data<T = DocumentResult>(response: Response, status = 200) {
  assert.equal(response.status, status)
  return (await response.json() as { data: T }).data
}

async function signIn(role: 'ADMIN' | 'ADVISOR') {
  const email = randomUUID() + '@example.invalid'
  const password = randomToken()
  await db.staffUser.create({ data: { role, email, displayName: 'Vérification documents', passwordHash: await hashPassword(password) } })
  const response = await request('/auth/login', { 'Content-Type': 'application/json' }, { method: 'POST', body: JSON.stringify({ email, password }) })
  const session = await data<{ csrfToken: string }>(response)
  return { Cookie: (response.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': session.csrfToken }
}

function upload(options: { kind?: string; bytes?: Buffer; name?: string; type?: string; version?: number; clientId?: string; headers?: Record<string, string> } = {}) {
  const params = new URLSearchParams({
    contractId, clientId: options.clientId ?? clientId, version: String(options.version ?? version), kind: options.kind ?? 'CONTRACT_SUPPORT',
  })
  return request('/admin/documents?' + params, {
    'Content-Type': options.type ?? 'application/pdf', 'X-Document-Filename': encodeURIComponent(options.name ?? 'Justificatif synthétique ' + unique + '.pdf'),
    ...(options.headers ?? advisor),
  }, { method: 'POST', body: new Uint8Array(options.bytes ?? uploadBytes) })
}

function archive(document: DocumentResult, headers = admin) {
  return request('/admin/documents/' + document.id + '/archive', { ...headers, 'Content-Type': 'application/json' },
    { method: 'POST', body: JSON.stringify({ version: document.version }) })
}

function download(id: string, headers = advisor, inline = false) {
  return request('/admin/documents/' + id + '/download' + (inline ? '?inline=true' : ''), headers)
}

before(async () => {
  await db.$connect()
  const app = await createApp(db, config)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  stop = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  admin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  const product = await db.insuranceProduct.upsert({ where: { slug: 'sante' }, update: {}, create: {
    slug: 'sante', title: 'Test santé', summary: 'Fiche synthétique', audiences: ['INDIVIDUAL'], eligibilityText: '',
    potentialCoverages: [], documentHints: [], faqs: [], relatedSlugs: [],
  } })
  const partner = await db.partner.create({ data: { name: 'Compagnie de test ' + unique } })
  const client = await db.client.create({ data: { displayName: 'Client synthétique ' + unique, profile: 'INDIVIDUAL', phone: '+212600003548' } })
  clientId = client.id
  const relations = { productId: product.id, partnerId: partner.id, clientId }
  quoteId = (await db.quote.create({ data: {
    ...relations, reference: quoteReference, annualPremiumMad: '14.50', status: 'ISSUED', issuedAt: new Date(), issuedSnapshot: { carrier: partner.name },
  } })).id
  contractId = (await db.contract.create({ data: {
    ...relations, reference: contractReference, quoteId, effectiveOn: onDate(today), expiresOn: onDate(addDays(today, 100)),
  } })).id
  quoteBytes = await syntheticPdf('offre historique')
  uploadBytes = await syntheticPdf('pièce de contrat')
  quoteDocumentId = randomUUID()
  const storageKey = quoteDocumentId + '.pdf'
  await writeFile(join(folder, storageKey), quoteBytes, { mode: 0o600 })
  await db.document.create({ data: {
    id: quoteDocumentId, kind: 'QUOTE_PDF', quoteId, status: 'READY', revision: 1, quoteVersion: 2, mimeType: 'application/pdf',
    storageKey, sha256: pdfDigest(quoteBytes), sizeBytes: quoteBytes.length, readyAt: new Date(),
  } })
})

after(async () => {
  await stop?.()
  await db.$disconnect()
  await rm(folder, { recursive: true, force: true })
})

test('document reads require staff and existing issued versions retain their metadata and preview', async () => {
  assert.equal((await request('/admin/documents', {})).status, 401)
  assert.equal((await request('/admin/documents/' + quoteDocumentId, {})).status, 401)
  assert.equal((await download(quoteDocumentId, {})).status, 401)
  const document = await data(await request('/admin/documents/' + quoteDocumentId))
  assert.equal(document.name, quoteReference + '.pdf')
  assert.equal(document.quoteVersion, 2)
  assert.equal(document.client.id, clientId)
  for (const field of ['sha256', 'storageKey']) assert.equal(field in document, false)
  assert.equal(document.canArchive, false)
  const response = await download(quoteDocumentId, advisor, true)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition') ?? '', /^inline;/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), quoteBytes)
  assert.equal(await db.auditEvent.count({ where: { targetId: quoteDocumentId, action: 'QUOTE_DOCUMENT_VIEWED' } }), 1)
})

test('uploads validate CSRF, file checks and business scope before writing', async () => {
  assert.equal((await upload({ headers: {} })).status, 401)
  assert.equal((await upload({ headers: { Cookie: advisor.Cookie } })).status, 403)
  assert.equal((await upload({ clientId: randomUUID() })).status, 422)
  assert.equal((await upload({ kind: 'QUOTE_PDF' })).status, 400)
  assert.equal((await upload({ name: 'test.docx' })).status, 422)
  assert.equal((await upload({ name: '../Exemple.pdf' })).status, 422)
  assert.equal((await upload({ type: 'image/png' })).status, 415)
  assert.equal((await upload({ bytes: Buffer.alloc(4 * 1024 * 1024 + 1) })).status, 413)
  assert.equal((await upload({ bytes: Buffer.from('simulation invalide') })).status, 422)
  assert.equal((await upload({ bytes: uploadBytes.subarray(0, 100) })).status, 422)
  assert.equal((await db.document.count({ where: { contractId } })), 0)
  assert.deepEqual(await readdir(folder), [quoteDocumentId + '.pdf'])
})

test('attachments are additive with concurrency, integrity and duplicate protections', async () => {
  const first = await Promise.all([upload(), upload()])
  assert.deepEqual(first.map(result => result.status).sort(), [201, 409])
  support = await data(first.find(result => result.status === 201)!, 201)
  version++
  const duplicate = await upload()
  assert.equal(duplicate.status, 409)
  assert.equal((await duplicate.json() as { error: { code: string } }).error.code, 'DOCUMENT_DUPLICATE')
  policy = await data(await upload({ kind: 'CONTRACT_PDF', name: 'Police synthétique.pdf' }), 201)
  version++
  assert.equal(support.revision, 1)
  assert.equal(policy.revision, 2)
  assert.equal(support.sizeBytes, String(uploadBytes.length))
  assert.equal(support.canPreview, false)
  assert.equal(support.canArchive, true)
  assert.equal(support.activity[0].action, 'DOCUMENT_UPLOADED')
  assert.equal((await download(support.id, advisor, true)).status, 404)
  const response = await download(policy.id)
  assert.match(response.headers.get('content-disposition') ?? '', /^attachment;/)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), uploadBytes)
})

test('inventory, pagination, customer search, filename search, dates and relationship filters use stored data', async () => {
  async function list(filters: Record<string, string>) {
    const response = await request('/admin/documents?' + new URLSearchParams(filters))
    assert.equal(response.status, 200)
    return await response.json() as DocumentPage
  }
  const first = await list({ clientId, q: 'CLIENT SYNTHÉTIQUE ' + unique, limit: '1', page: '1' })
  const second = await list({ clientId, q: 'CLIENT SYNTHÉTIQUE ' + unique, limit: '1', page: '2' })
  assert.equal(first.meta.total, 3)
  assert.notEqual(first.data[0].id, second.data[0].id)
  const inventory = await db.document.aggregate({ _count: true, _sum: { sizeBytes: true } })
  assert.equal(first.storage.count, inventory._count)
  assert.equal(first.storage.sizeBytes, inventory._sum.sizeBytes?.toString())
  const matching = await list({ q: 'JUSTIFICATIF SYNTHÉTIQUE ' + unique, kind: 'CONTRACT_SUPPORT', status: 'READY', from: today, to: today })
  assert.deepEqual(matching.data.map(row => row.id), [support.id])
  assert.deepEqual((await list({ q: quoteReference + '.pdf', quoteId })).data.map(row => row.id), [quoteDocumentId])
  assert.deepEqual((await list({ q: contractReference, contractId, from: addDays(today, 1) })).data, [])
})

test('archival requires an administrator, protects primary records and preserves historical bytes', async () => {
  assert.equal((await archive(support, advisor)).status, 403)
  assert.equal((await archive(support, { Cookie: admin.Cookie, 'Content-Type': 'application/json' })).status, 403)
  assert.equal((await archive(policy)).status, 409)
  assert.equal((await archive(await data(await request('/admin/documents/' + quoteDocumentId)))).status, 409)
  const outcomes = await Promise.all([archive(support), archive(support)])
  assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 409])
  const archived = await data(outcomes.find(result => result.status === 200)!)
  assert.ok(archived.archivedAt)
  assert.equal(archived.version, 2)
  assert.equal(archived.activity[0].action, 'DOCUMENT_ARCHIVED')
  const active = await (await request('/admin/documents?contractId=' + contractId)).json() as DocumentPage
  assert.deepEqual(active.data.map(row => row.id), [policy.id])
  const archives = await (await request('/admin/documents?archived=true&contractId=' + contractId)).json() as DocumentPage
  assert.deepEqual(archives.data.map(row => row.id), [support.id])
  assert.deepEqual(Buffer.from(await (await download(support.id)).arrayBuffer()), uploadBytes)
  assert.deepEqual(Buffer.from(await (await download(quoteDocumentId)).arrayBuffer()), quoteBytes)
})

test('missing, replaced, non-private and symbolic-link files fail closed', async () => {
  const path = join(folder, quoteDocumentId + '.pdf')
  const saved = path + '.backup'
  await rename(path, saved)
  try {
    assert.equal((await download(quoteDocumentId)).status, 503)
    await symlink(saved, path)
    assert.equal((await download(quoteDocumentId)).status, 503)
    await unlink(path)
    const modified = Buffer.from(quoteBytes)
    modified[modified.length - 5] ^= 1
    await writeFile(path, modified, { mode: 0o600 })
    assert.equal((await download(quoteDocumentId)).status, 503)
    await writeFile(path, quoteBytes)
    await chmod(path, 0o644)
    assert.equal((await download(quoteDocumentId)).status, 503)
  } finally {
    await rm(path, { force: true })
    await rename(saved, path)
  }
  assert.deepEqual(await readFile(path), quoteBytes)
  assert.equal((await download('%2e%2e%2funsupported.pdf')).status, 404)
})

test('storage and database failures leave existing files and contract versions intact', async () => {
  const files = (await readdir(folder)).sort()
  const other = await syntheticPdf('vérification de la transaction')
  await chmod(folder, 0o755)
  try { assert.equal((await upload({ bytes: other })).status, 503) }
  finally { await chmod(folder, 0o700) }

  await db.$executeRaw`ALTER TABLE documents ADD CONSTRAINT document_test_rollback CHECK (original_name IS DISTINCT FROM 'b11-transaction-failure.pdf')`
  try {
    const failure = await upload({ bytes: other, name: 'b11-transaction-failure.pdf' })
    assert.equal(failure.status, 500)
    assert.equal((await failure.json() as { error: { code: string } }).error.code, 'INTERNAL_ERROR')
  } finally { await db.$executeRaw`ALTER TABLE documents DROP CONSTRAINT document_test_rollback` }
  assert.deepEqual((await readdir(folder)).sort(), files)
  assert.equal((await db.contract.findUniqueOrThrow({ where: { id: contractId } })).version, version)
  assert.equal((await db.document.count({ where: { contractId } })), 2)
})

test('an interrupted upload writes no document and repeated attempts are throttled', async () => {
  const files = (await readdir(folder)).sort()
  const params = new URLSearchParams({ contractId, version: String(version), kind: 'BUSINESS_PDF' })
  await new Promise<void>(resolve => {
    const request = httpRequest(origin + '/api/admin/documents?' + params, {
      method: 'POST', headers: { ...advisor, Origin: config.PUBLIC_ORIGIN, 'Content-Type': 'application/pdf',
        'Content-Length': uploadBytes.length, 'X-Document-Filename': 'interrupted.pdf' },
    })
    request.on('error', () => resolve())
    request.write(uploadBytes.subarray(0, 100), () => request.destroy())
  })
  const freshStaff = await signIn('ADVISOR')
  for (let attempt = 0; attempt < 30; attempt++) {
    assert.equal((await upload({ bytes: Buffer.from('invalid'), headers: freshStaff })).status, 422)
  }
  const limited = await upload({ headers: freshStaff })
  assert.equal(limited.status, 429)
  assert.ok(Number(limited.headers.get('retry-after')) > 0)
  assert.equal((await db.contract.findUniqueOrThrow({ where: { id: contractId } })).version, version)
  assert.deepEqual((await readdir(folder)).sort(), files)
})

test('production mode keeps the upload gate and disallows destructive document routes', async () => {
  const savedOrigin = origin
  const server = (await createApp(db, { ...config, NODE_ENV: 'production' })).listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  try {
    assert.equal((await upload()).status, 503)
    assert.equal((await request('/admin/documents/' + support.id, admin, { method: 'DELETE' })).status, 404)
    const listing = await (await request('/admin/documents')).json() as { uploadEnabled: boolean }
    assert.equal(listing.uploadEnabled, false)
  } finally {
    origin = savedOrigin
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
