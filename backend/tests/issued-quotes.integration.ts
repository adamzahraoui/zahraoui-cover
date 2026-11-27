import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { SendMailOptions } from 'nodemailer'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { casablancaDate } from '../src/modules/business-inputs.js'
import type { Mailer } from '../src/modules/notifications/mail-jobs.js'
import { privateDirectory, quotePdfEnabled, readPdf } from '../src/modules/quotes/files.js'
import { deliverNextQuote, generateNextQuotePdf, maintainQuoteJobs } from '../src/modules/quotes/jobs.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must use a dedicated local _test database.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) throw new Error('Test database required.')
const folder = await mkdtemp(join(tmpdir(), 'zc-quote-test-'))
const config = loadConfig({
  ...process.env, DATABASE_URL: testUrl, QUOTE_PDF_DIR: folder,
  RATE_KEY_SECRET: randomBytes(32).toString('hex'), SMTP_MODE: 'local',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'broker@example.invalid',
})
const db = connectPrisma(testUrl)
let origin: string
let close: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let clientId: string
let partnerId: string
let requestId: string
let quote: Result
let docId: string
let pdf: Buffer
let revised: Result
const deliveries: SendMailOptions[] = []
const successMailer = { sendMail: async (mail: SendMailOptions) => { deliveries.push(mail); return { accepted: ['accepted'] } } } as unknown as Mailer
const failureMailer = { sendMail: async () => { throw new Error('Synthetic transport failure') } } as unknown as Mailer
const email = randomUUID() + '@example.invalid'
const validUntil = new Date(Date.now() + 86_400_000 * 15).toISOString().slice(0, 10)
const offer = {
  annualPremiumMad: '1210.07', feesMad: '8.11', taxesMad: '2.19',
  coverage: 'Couverture proposée, rédigée pour un essai.', coverageLimits: 'Plafond proposé : 50 000 MAD.',
  deductibles: 'Franchise indicative de vérification.', conditions: 'Exclusions et conditions à vérifier.',
  customerNotes: 'Note destinée au client.', internalNotes: 'Note privée de contrôle.', validUntil,
}
type Result = {
  id: string; reference: string; version: number; status: string; totalMad: string;
  revision: number; coverage: string; documents: { id: string; status: string; quoteVersion: number }[];
  revisions: { id: string; revision: number }[]; decidedAt: string; decisionMethod: string;
}
async function data<T = Result>(response: Response, status = 200) {
  assert.equal(response.status, status)
  return (await response.json() as { data: T }).data
}
function call(path: string, method = 'GET', body?: object, headers: Record<string, string> = {}) {
  return fetch(origin + '/api' + path, {
    method, headers: { Origin: config.PUBLIC_ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}
function create(overrides = {}, headers = advisor) {
  return call('/admin/quotes', 'POST', { ...offer, clientId, requestId, partnerId, productSlug: 'voyage', ...overrides }, headers)
}
function action(record: Result, name: string, body = {}, headers = admin) {
  return call('/admin/quotes/' + record.id + '/' + name, 'POST', { version: record.version, ...body }, headers)
}
async function signIn(role: 'ADMIN' | 'ADVISOR') {
  const email = randomUUID() + '@example.invalid'
  const password = randomToken()
  await db.staffUser.create({ data: { role, displayName: 'Vérification devis', email, passwordHash: await hashPassword(password) } })
  const response = await call('/auth/login', 'POST', { email, password })
  const { csrfToken } = await data<{ csrfToken: string }>(response)
  return { Cookie: (response.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': csrfToken }
}

before(async () => {
  await db.$connect()
  const server = (await createApp(db, config)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  admin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  const product = await db.insuranceProduct.upsert({
    where: { slug: 'voyage' }, update: {}, create: { slug: 'voyage', title: 'Voyage', summary: 'Assurance de vérification.',
      audiences: ['INDIVIDUAL'], eligibilityText: '', potentialCoverages: [], documentHints: [], faqs: [], relatedSlugs: [] },
  })
  clientId = (await db.client.create({ data: { displayName: 'Client synthétique', phone: '+212600000010', email, profile: 'INDIVIDUAL' } })).id
  partnerId = (await db.partner.create({ data: { name: 'Compagnie de test ' + randomUUID(), categories: ['voyage'], verifiedAt: new Date(), verificationReference: 'Fixture historique vérifiée', isActive: true } })).id
  requestId = (await db.quoteRequest.create({ data: {
    clientId, productId: product.id, reference: 'DEV-' + randomBytes(12).toString('hex').toUpperCase(), profile: 'INDIVIDUAL',
    firstName: 'Client', lastName: 'Synthétique', phone: '+212600000010', email, city: 'Rabat', needs: 'Besoin de test sans données réelles.',
    noticeVersion: 'fixture-b8', acknowledgedAt: new Date(), notes: { create: { body: 'Note à préserver.' } },
  } })).id
})
after(async () => {
  await close?.()
  await db.$disconnect()
  await rm(folder, { recursive: true, force: true })
})

test('staff create and edit drafts with fixed precision and compatible relations', async () => {
  assert.equal((await create({}, {})).status, 401)
  assert.equal((await create({}, { Cookie: admin.Cookie })).status, 403)
  for (const overrides of [{ clientId: randomUUID() }, { productSlug: 'automobile' }, { partnerId: randomUUID() }]) {
    assert.equal((await create(overrides)).status, 409)
  }
  assert.equal((await create({ annualPremiumMad: '2.001' })).status, 422)
  assert.equal((await create({ annualPremiumMad: 0.1 })).status, 422)
  assert.equal((await create({ annualPremiumMad: '9999999999.99' })).status, 422)
  quote = await data(await create(), 201)
  assert.equal(quote.totalMad, '1220.37')
  assert.equal(quote.status, 'DRAFT')
  const path = '/admin/quotes/' + quote.id
  quote = await data(await call(path, 'PATCH', { version: quote.version, annualPremiumMad: '1200.01' }, advisor))
  assert.equal(quote.totalMad, '1210.31')
  assert.equal((await call(path, 'PATCH', { version: 1, feesMad: '2' }, advisor)).status, 409)
  assert.equal((await action(quote, 'issue', {}, advisor)).status, 403)
  assert.equal((await action(quote, 'decision', { status: 'ACCEPTED', method: 'PHONE', evidence: 'Cas de test' })).status, 409)
})

test('issuance freezes a PDF version, generates the document and requires authorization and safe paths', async () => {
  quote = await data(await action(quote, 'issue'), 202)
  assert.equal(quote.status, 'ISSUED')
  assert.equal(quotePdfEnabled({ ...config, NODE_ENV: 'production' }), false)
  const document = quote.documents[0]
  assert.equal(document.quoteVersion, quote.version)
  docId = document.id
  assert.equal((await action(quote, 'issue')).status, 409)
  assert.equal((await action(quote, 'send')).status, 409)
  assert.equal(await generateNextQuotePdf(db, config), true)
  const url = '/admin/documents/' + docId + '/download'
  assert.equal((await call(url)).status, 401)
  assert.equal((await call('/admin/documents/%2e%2e%2fprivate.pdf/download', 'GET', undefined, advisor)).status, 404)
  assert.equal((await call('/admin/documents/' + randomUUID() + '/download', 'GET', undefined, advisor)).status, 404)
  const response = await call(url + '?inline=true', 'GET', undefined, advisor)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type') ?? '', /^application\/pdf/)
  assert.match(response.headers.get('content-disposition') ?? '', /^inline;/)
  pdf = Buffer.from(await response.arrayBuffer())
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  const row = await db.document.findUniqueOrThrow({ where: { id: docId } })
  assert.equal(row.status, 'READY')
  assert.equal(row.sizeBytes, BigInt(pdf.length))
  await assert.rejects(readPdf(await privateDirectory(config), '../unexpected.pdf'))
  const symlinkKey = randomUUID() + '.pdf'
  await symlink(join(folder, row.storageKey!), join(folder, symlinkKey))
  await assert.rejects(readPdf(folder, symlinkKey))
  assert.equal((await call('/admin/quotes/' + quote.id, 'PATCH', { version: quote.version, coverage: 'Modification interdite' }, advisor)).status, 409)
})

test('queue deduplicates, delivery failure preserves request and success synchronizes the exact PDF', async () => {
  await db.client.update({ where: { id: clientId }, data: { intakeProvisional: true } })
  assert.equal((await action(quote, 'send')).status, 409)
  await db.client.update({ where: { id: clientId }, data: { intakeProvisional: false, email } })
  quote = await data(await action(quote, 'send'), 202)
  await data(await action(quote, 'send'), 202)
  const [job] = await db.outboxJob.findMany({ where: { documentId: docId, kind: 'QUOTE_DELIVERY' } })
  assert.equal(await db.outboxJob.count({ where: { documentId: docId, kind: 'QUOTE_DELIVERY' } }), 1)
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })).status, 'NEW')
  assert.equal(await deliverNextQuote(db, config, failureMailer), true)
  const failed = await db.outboxJob.findUniqueOrThrow({ where: { id: job.id } })
  assert.equal(failed.state, 'PENDING')
  assert.equal(failed.lastErrorCode, 'QUOTE_SMTP_RETRY')
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })).status, 'NEW')
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } })
  assert.equal((await call('/admin/clients/' + clientId, 'PATCH', { version: client.version, email: 'changed@example.invalid' }, admin)).status, 409)
  assert.equal((await action(quote, 'cancel')).status, 409)
  for (let attempt = 2; attempt <= 5; attempt++) {
    await db.outboxJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date() } })
    assert.equal(await deliverNextQuote(db, config, failureMailer), true)
  }
  assert.equal((await db.outboxJob.findUniqueOrThrow({ where: { id: job.id } })).state, 'FAILED')
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })).status, 'NEW')
  quote = await data(await action(quote, 'send'), 202)
  assert.equal(await db.outboxJob.count({ where: { documentId: docId, kind: 'QUOTE_DELIVERY' } }), 1)
  assert.equal(await deliverNextQuote(db, config, successMailer), true)
  const attachment = deliveries[0].attachments?.[0]
  assert.deepEqual(attachment?.content, pdf)
  assert.equal(attachment?.filename, quote.reference + '.pdf')
  quote = await data(await call('/admin/quotes/' + quote.id, 'GET', undefined, admin))
  assert.equal(quote.status, 'SENT')
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })).status, 'QUOTE_SENT')
  assert.equal(await db.requestNote.count({ where: { requestId } }), 1)
  assert.equal((await action(quote, 'send')).status, 409)
  assert.equal(await db.auditEvent.count({ where: { targetId: requestId, action: 'QUOTE_REQUEST_DELIVERED' } }), 1)
})

test('revision creates a separate draft, preserves the historical PDF and restricts decisions', async () => {
  revised = await data(await action(quote, 'revision'), 201)
  assert.equal(revised.revision, 2)
  assert.equal(revised.status, 'DRAFT')
  assert.deepEqual(revised.revisions.map(row => row.id), [revised.id, quote.id])
  const old = await data(await call('/admin/quotes/' + quote.id, 'GET', undefined, admin))
  assert.equal(old.status, 'CANCELLED')
  assert.equal((await action(old, 'decision', { status: 'ACCEPTED', method: 'PHONE', evidence: 'Vérifié' })).status, 409)
  assert.deepEqual(Buffer.from(await (await call('/admin/documents/' + docId + '/download', 'GET', undefined, admin)).arrayBuffer()), pdf)
  revised = await data(await call('/admin/quotes/' + revised.id, 'PATCH', { version: revised.version, validUntil, coverage: 'Garantie de vérification révisée.' }, advisor))
  revised = await data(await action(revised, 'issue'), 202)
  assert.equal(await generateNextQuotePdf(db, config), true)
  revised = await data(await action(revised, 'send'), 202)
  assert.equal(await deliverNextQuote(db, config, successMailer), true)
  revised = await data(await call('/admin/quotes/' + revised.id, 'GET', undefined, admin))
  assert.equal((await action(revised, 'decision', { status: 'ACCEPTED', method: 'EMAIL', evidence: 'Validation de test' }, advisor)).status, 403)
  revised = await data(await action(revised, 'decision', { status: 'ACCEPTED', method: 'EMAIL', evidence: 'Validation de test' }))
  assert.equal(revised.status, 'ACCEPTED')
  assert.equal(revised.decisionMethod, 'EMAIL')
  assert.ok(revised.decidedAt)
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })).status, 'ACCEPTED')
  assert.equal(await db.contract.count({ where: { quoteId: revised.id } }), 0)
})

test('refusal, expiry and dashboard metrics use real offers', async () => {
  let alternative = await data(await create({ requestId: null }), 201)
  alternative = await data(await action(alternative, 'issue'), 202)
  assert.equal(await generateNextQuotePdf(db, config), true)
  alternative = await data(await action(alternative, 'send'), 202)
  assert.equal(await deliverNextQuote(db, config, successMailer), true)
  alternative = await data(await call('/admin/quotes/' + alternative.id, 'GET', undefined, admin))
  assert.equal((await data(await action(alternative, 'decision', { status: 'DECLINED', method: 'PHONE', evidence: 'Refus de vérification' }))).status, 'DECLINED')

  let expiring = await data(await create({ requestId: null }), 201)
  expiring = await data(await action(expiring, 'issue'), 202)
  assert.equal(await generateNextQuotePdf(db, config), true)
  await db.quote.update({ where: { id: expiring.id }, data: { status: 'SENT', sentAt: new Date(), validUntil: new Date('2000-01-01') } })
  assert.equal((await action(expiring, 'decision', { status: 'ACCEPTED', method: 'LETTER', evidence: 'Trop tard' })).status, 409)
  await maintainQuoteJobs(db)
  assert.equal((await db.quote.findUniqueOrThrow({ where: { id: expiring.id } })).status, 'EXPIRED')
  const stats = await data<{ quoteCounts: Record<string, number>; recentQuotes: { id: string }[] }>(await call('/admin/dashboard', 'GET', undefined, advisor))
  for (const status of ['ACCEPTED', 'DECLINED', 'EXPIRED']) assert.ok(stats.quoteCounts[status] >= 1)
  assert.ok(stats.recentQuotes.some(row => row.id === revised.id))
  const list = await data<{ id: string }[]>(await call('/admin/quotes?' + new URLSearchParams({
    status: 'EXPIRED', productSlug: 'voyage', from: casablancaDate(), to: casablancaDate(), q: expiring.reference,
  }), 'GET', undefined, advisor))
  assert.equal(list[0].id, expiring.id)
})

test('declining one of two delivered offers keeps the request open until the final refusal', async () => {
  const firstRequest = await db.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })
  const another = await db.quoteRequest.create({ data: {
    clientId, productId: firstRequest.productId, reference: 'DEV-' + randomBytes(12).toString('hex').toUpperCase(),
    profile: firstRequest.profile, firstName: firstRequest.firstName, lastName: firstRequest.lastName, phone: firstRequest.phone,
    email, city: firstRequest.city, needs: firstRequest.needs, noticeVersion: firstRequest.noticeVersion, acknowledgedAt: new Date(),
  } })
  async function sendOffer() {
    let row = await data(await create({ requestId: another.id }), 201)
    row = await data(await action(row, 'issue'), 202)
    assert.equal(await generateNextQuotePdf(db, config), true)
    row = await data(await action(row, 'send'), 202)
    assert.equal(await deliverNextQuote(db, config, successMailer), true)
    return data(await call('/admin/quotes/' + row.id, 'GET', undefined, admin))
  }
  const first = await sendOffer()
  const second = await sendOffer()
  const evidence = { status: 'DECLINED', method: 'PHONE', evidence: 'Refus de vérification.' }
  await data(await action(first, 'decision', evidence))
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: another.id } })).status, 'QUOTE_SENT')
  await data(await action(second, 'decision', evidence))
  assert.equal((await db.quoteRequest.findUniqueOrThrow({ where: { id: another.id } })).status, 'DECLINED')
})
