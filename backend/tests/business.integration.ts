import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { casablancaDate } from '../src/modules/business-inputs.js'
import { deliverNextMail, smtpMailer } from '../src/modules/notifications/mail-jobs.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must point to a dedicated loopback database ending in _test.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) {
  throw new Error('Run this suite only on a dedicated local _test database with NODE_ENV=test.')
}
const config = loadConfig({
  ...process.env, DATABASE_URL: testUrl, TRUST_PROXY_HOPS: '1', RATE_KEY_SECRET: randomBytes(32).toString('hex'),
  IDEMPOTENCY_KEY_SECRET: randomBytes(32).toString('hex'), PRIVACY_NOTICE_VERSION: 'fixture-b45',
  QUOTE_NOTICE_TEXT: 'Notice fictive de test concernant le traitement des demandes de devis.',
  QUOTE_ACK_EMAIL: 'true', INTAKE_NOTIFY_EMAIL: 'agency@example.invalid',
  SMTP_MODE: 'local', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'brokerage@example.invalid',
})
const database = connectPrisma(testUrl)
let origin: string
let close: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let productId: string
let requestId: string
let reference: string
let intakeSource = '192.0.2.10'
const suffix = randomUUID().slice(0, 8)
const email = `intake-${suffix}@example.invalid`
const name = `Dossier${suffix}`

const catalogBody = {
  slug: 'automobile', title: 'Automobile · fixture', summary: 'Catégorie de démonstration pour les tests isolés.',
  audiences: ['INDIVIDUAL'], potentialCoverages: [{ title: 'Exemple de garantie', description: 'Exemple indicatif.' }],
  eligibilityText: '', documentHints: [], faqs: [], relatedSlugs: [], displayOrder: 0, isActive: true, isPublished: false,
}
const intake = {
  profile: 'INDIVIDUAL', productSlug: 'automobile', context: 'Véhicule personnel',
  needs: 'Comparer les protections applicables à un véhicule utilisé quotidiennement.',
  firstName: name, lastName: 'Exemple', phone: '06 00 00 00 10', email, city: 'Casablanca',
  noticeVersion: 'fixture-b45', acknowledged: true,
}
const issue = async (response: Response, status: number, code: string) => {
  assert.equal(response.status, status)
  const payload = await response.json() as { error: { code: string } }
  assert.equal(payload.error.code, code)
}

function send(path: string, method = 'GET', body?: object, headers: Record<string, string> = {}) {
  return fetch(origin + '/api' + path, {
    method, headers: { Origin: config.PUBLIC_ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function signIn(role: 'ADMIN' | 'ADVISOR') {
  const password = randomToken()
  const email = `case-${randomUUID()}@example.invalid`
  await database.staffUser.create({ data: { email, displayName: 'Vérification', role, passwordHash: await hashPassword(password) } })
  const response = await send('/auth/login', 'POST', { email, password })
  assert.equal(response.status, 200)
  const payload = await response.json() as { data: { csrfToken: string } }
  return { Cookie: (response.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': payload.data.csrfToken }
}

before(async () => {
  await database.$connect()
  const server = (await createApp(database, config)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  admin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  const existing = await database.insuranceProduct.findUnique({ where: { slug: 'automobile' } })
  if (existing) {
    productId = existing.id
    await database.insuranceProduct.update({ where: { id: productId }, data: { isActive: true, isPublished: false, audiences: ['INDIVIDUAL'] } })
  }
})

after(async () => {
  await close?.()
  await database.$disconnect()
})

async function visibility(input: { isActive?: boolean; isPublished?: boolean }) {
  const product = await database.insuranceProduct.findUniqueOrThrow({ where: { id: productId } })
  return send('/admin/catalog/' + productId, 'PATCH', { version: product.version, ...input }, admin)
}
async function quote(body: object = intake, key = randomUUID()) {
  return send('/quotes', 'POST', body, { 'Idempotency-Key': key, 'X-Forwarded-For': intakeSource })
}

test('reserved catalog writes require ADMIN and CSRF; public filtering hides draft and inactive products', async () => {
  await issue(await send('/admin/catalog'), 401, 'UNAUTHENTICATED')
  await issue(await send('/admin/catalog', 'POST', catalogBody, advisor), 403, 'FORBIDDEN')
  await issue(await send('/admin/catalog', 'POST', catalogBody, { Cookie: admin.Cookie }), 403, 'CSRF_FAILED')
  const creation = await send('/admin/catalog', 'POST', catalogBody, admin)
  if (!productId) {
    assert.equal(creation.status, 201)
    productId = (await creation.json() as { data: { id: string } }).data.id
  } else await issue(creation, 409, 'PRODUCT_EXISTS')

  const adminDetail = await send('/admin/catalog/' + productId, 'GET', undefined, advisor)
  assert.equal(adminDetail.status, 200)
  await issue(await send('/catalog/automobile'), 404, 'NOT_FOUND')
  assert.equal((await visibility({ isPublished: true })).status, 200)
  const published = await (await send('/catalog/automobile')).json() as { data: Record<string, unknown> }
  assert.equal(published.data.slug, 'automobile')
  assert.ok(!('version' in published.data || 'isPublished' in published.data))
  const byAudience = async (audience: string) =>
    (await (await send('/catalog?audience=' + audience)).json() as { data: { id: string }[] }).data
  assert.ok((await byAudience('INDIVIDUAL')).some(item => item.id === productId))
  assert.ok(!(await byAudience('BUSINESS')).some(item => item.id === productId))
  assert.equal((await visibility({ isActive: false })).status, 200)
  await issue(await send('/catalog/automobile'), 404, 'NOT_FOUND')
  await issue(await visibility({ isPublished: true }), 409, 'INVALID_STATE')
  assert.equal((await visibility({ isActive: true })).status, 200)
  await issue(await send('/catalog/automobile'), 404, 'NOT_FOUND')
})

test('quote qualification rejects invalid body, missing consent, slug, context, consent version and draft products', async () => {
  const missingConsent: Partial<typeof intake> = { ...intake }
  delete missingConsent.acknowledged
  await issue(await quote(missingConsent), 422, 'VALIDATION_FAILED')
  await issue(await quote({ ...intake, phone: 'abc' }), 422, 'VALIDATION_FAILED')
  await issue(await quote({ ...intake, productSlug: 'unknown' }), 422, 'VALIDATION_FAILED')
  await issue(await quote({ ...intake, context: 'Appartement' }), 422, 'VALIDATION_FAILED')
  await issue(await quote({ ...intake, noticeVersion: 'old' }), 409, 'NOTICE_CHANGED')
  await issue(await quote(), 409, 'PRODUCT_UNAVAILABLE')
  assert.equal((await visibility({ isPublished: true })).status, 200)
  await issue(await quote({ ...intake, profile: 'BUSINESS' }), 409, 'PRODUCT_UNAVAILABLE')
})

test('anonymous submission is atomic, linked to a provisional client and replayable after unpublication', async () => {
  intakeSource = '192.0.2.11'
  const verified = await database.client.create({ data: { profile: 'INDIVIDUAL', displayName: 'Fiche existante', phone: '+212600000010', email } })
  const key = randomUUID()
  const responses = await Promise.all([quote(intake, key), quote(intake, key)])
  assert.deepEqual(responses.map(result => result.status), [201, 201])
  const receipts = await Promise.all(responses.map(response => response.json() as Promise<{ data: { reference: string; receivedAt: string } }>))
  assert.deepEqual(receipts[0], receipts[1])
  assert.deepEqual(Object.keys(receipts[0].data).sort(), ['receivedAt', 'reference'])
  reference = receipts[0].data.reference
  const row = await database.quoteRequest.findUniqueOrThrow({ where: { reference }, include: { client: true, outboxJobs: true } })
  requestId = row.id
  assert.notEqual(row.clientId, verified.id)
  assert.equal(row.client?.intakeProvisional, true)
  assert.equal(row.client?.phone, '+212600000010')
  assert.equal(row.noticeVersion, config.PRIVACY_NOTICE_VERSION)
  assert.match(row.needs, /Véhicule personnel/)
  assert.deepEqual(row.outboxJobs.map(job => job.kind).sort(), ['REQUEST_ACK','REQUEST_ALERT'])
  assert.equal((await database.client.findUniqueOrThrow({ where: { id: verified.id } })).displayName, 'Fiche existante')
  assert.equal((await visibility({ isPublished: false })).status, 200)
  const replay = await quote(intake, key)
  assert.equal(replay.status, 201)
  assert.deepEqual(await replay.json(), receipts[0])
  await issue(await quote({ ...intake, city: 'Rabat' }, key), 409, 'IDEMPOTENCY_CONFLICT')
  assert.equal(await database.quoteRequest.count({ where: { email } }), 1)
  assert.equal((await visibility({ isPublished: true })).status, 200)
})

test('outbox insertion failure rolls back the quote, customer, receipt key and audit event', async () => {
  intakeSource = '192.0.2.12'
  const auditCount = await database.auditEvent.count({ where: { action: 'QUOTE_REQUEST_RECEIVED' } })
  const testEmail = `rollback-${suffix}@example.invalid`
  const key = randomUUID()
  await database.$executeRaw`
    CREATE OR REPLACE FUNCTION zc_test_reject_rollback_message() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (SELECT first_name FROM quote_requests WHERE id = NEW.request_id) = 'RollbackB45' THEN
        RAISE EXCEPTION 'test-only queue failure';
      END IF;
      RETURN NEW;
    END;
    $$
  `
  await database.$executeRaw`
    CREATE TRIGGER zc_test_reject_rollback_message BEFORE INSERT ON outbox_jobs
    FOR EACH ROW EXECUTE FUNCTION zc_test_reject_rollback_message()
  `
  try {
    await issue(await quote({ ...intake, firstName: 'RollbackB45', email: testEmail }, key), 500, 'INTERNAL_ERROR')
    assert.equal(await database.client.count({ where: { email: testEmail } }), 0)
    assert.equal(await database.quoteRequest.count({ where: { email: testEmail } }), 0)
    assert.equal(await database.submissionKey.count({ where: { key } }), 0)
    assert.equal(await database.auditEvent.count({ where: { action: 'QUOTE_REQUEST_RECEIVED' } }), auditCount)
  } finally {
    await database.$executeRaw`DROP TRIGGER zc_test_reject_rollback_message ON outbox_jobs`
    await database.$executeRaw`DROP FUNCTION zc_test_reject_rollback_message()`
  }
})

test('staff list and detail support scoped search, Casablanca date, filters and pagination', async () => {
  await issue(await send('/admin/quote-requests/' + requestId), 401, 'UNAUTHENTICATED')
  await issue(await send('/admin/clients?q=Fiche'), 401, 'UNAUTHENTICATED')
  const query = new URLSearchParams({ q: name + ' Exemple', status: 'NEW', productSlug: 'automobile', from: casablancaDate(), to: casablancaDate(), limit: '1' })
  const list = await (await send('/admin/quote-requests?' + query, 'GET', undefined, advisor)).json() as { data: { reference: string }[]; meta: { page: number; total: number } }
  assert.equal(list.meta.total, 1)
  assert.equal(list.data[0].reference, reference)
  query.set('page','2')
  assert.deepEqual((await (await send('/admin/quote-requests?' + query, 'GET', undefined, advisor)).json() as { data: object[] }).data, [])
  const detail = await send('/admin/quote-requests/' + requestId, 'GET', undefined, advisor)
  assert.equal(detail.status, 200)
  const { data } = await detail.json() as { data: { email: string; client: { intakeProvisional: boolean }; notes: object[] } }
  assert.equal(data.email, email)
  assert.equal(data.client.intakeProvisional, true)
  assert.deepEqual(data.notes, [])
  assert.equal((await send('/admin/quote-requests?q=%25%27%20OR%20TRUE', 'GET', undefined, advisor)).status, 200)
})

test('status handling requires a valid transition and version; notes are persisted and audited', async () => {
  const path = '/admin/quote-requests/' + requestId
  await issue(await send(path, 'PATCH', { version: 1, status: 'IN_REVIEW' }, { Cookie: advisor.Cookie }), 403, 'CSRF_FAILED')
  await issue(await send(path, 'PATCH', { version: 1, status: 'QUOTE_SENT' }, advisor), 409, 'INVALID_TRANSITION')
  assert.equal((await send(path, 'PATCH', { version: 1, status: 'IN_REVIEW' }, advisor)).status, 200)
  await issue(await send(path, 'PATCH', { version: 1, status: 'CLOSED' }, advisor), 409, 'STALE_VERSION')
  await issue(await send(path, 'PATCH', { version: 2, status: 'QUOTE_SENT' }, advisor), 409, 'INVALID_TRANSITION')
  const linked = await database.client.findFirstOrThrow({ where: { email, intakeProvisional: false } })
  assert.equal((await send(path, 'PATCH', { version: 2, clientId: linked.id }, advisor)).status, 200)
  const note = await send(path + '/notes', 'POST', { version: 3, body: 'Note de suivi stockée en texte.' }, advisor)
  assert.equal(note.status, 201)
  const row = await database.quoteRequest.findUniqueOrThrow({ where: { id: requestId }, include: { notes: true } })
  assert.equal(row.version, 4)
  assert.equal(row.clientId, linked.id)
  assert.equal(row.email, email)
  assert.equal(row.notes.length, 1)
  assert.equal(await database.auditEvent.count({ where: { targetId: requestId, targetType: 'quote_request' } }), 4)
})

test('dashboard uses real quote counts, recent requests and logged activity', async () => {
  await issue(await send('/admin/dashboard'), 401, 'UNAUTHENTICATED')
  const response = await send('/admin/dashboard', 'GET', undefined, advisor)
  assert.equal(response.status, 200)
  const { data } = await response.json() as { data: {
    counts: { totalRequests: number; inReviewRequests: number }
    recentRequests: { id: string; status: string }[]
    byProduct: { slug: string; count: number }[]
    activity: { targetId: string; action: string }[]
  } }
  assert.equal(data.counts.totalRequests, await database.quoteRequest.count())
  assert.equal(data.counts.inReviewRequests, await database.quoteRequest.count({ where: { status: 'IN_REVIEW' } }))
  assert.ok(data.recentRequests.some(row => row.id === requestId && row.status === 'IN_REVIEW'))
  assert.ok(data.byProduct.some(row => row.slug === 'automobile' && row.count > 0))
  assert.ok(data.activity.some(row => row.targetId === requestId && row.action === 'QUOTE_REQUEST_NOTE_ADDED'))
})

test('SMTP failure schedules retries and never removes the persisted request', async () => {
  const listener = createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = (listener.address() as AddressInfo).port
  await new Promise<void>(resolve => listener.close(() => resolve()))
  const options = { ...config, SMTP_PORT: port }
  const mailer = smtpMailer(options)
  assert.ok(mailer)
  try {
    const job = await database.outboxJob.findFirstOrThrow({ where: { requestId, kind: 'REQUEST_ACK' } })
    // Prior queued mail in a reused isolated database may also receive a retry.
    for (let n = 0; n < 50; n++) {
      const current = await database.outboxJob.findUniqueOrThrow({ where: { id: job.id } })
      if (current.lastErrorCode === 'SMTP_RETRY') break
      if (!await deliverNextMail(database, options, mailer)) break
    }
    const retried = await database.outboxJob.findUniqueOrThrow({ where: { id: job.id } })
    assert.equal(retried.state, 'PENDING')
    assert.equal(retried.lastErrorCode, 'SMTP_RETRY')
    assert.ok(retried.nextAttemptAt > new Date())
    assert.equal((await database.quoteRequest.findUniqueOrThrow({ where: { id: requestId } })).reference, reference)
  } finally {
    mailer.close()
  }
})

test('public intake rate limits abusive submissions by source', async () => {
  intakeSource = '192.0.2.13'
  const responses = await Promise.all(Array.from({ length: 11 }, () => quote({})))
  assert.equal(responses.filter(response => response.status === 422).length, 10)
  const throttled = responses.find(response => response.status === 429)
  assert.ok(throttled && Number(throttled.headers.get('retry-after')) > 0)
})
