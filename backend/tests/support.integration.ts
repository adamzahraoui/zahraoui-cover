import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:net'
import type { AddressInfo } from 'node:net'
import { after, before, test } from 'node:test'
import type { AssistanceCase, Client, ContactMessage } from '@prisma/client'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { casablancaDate } from '../src/modules/business-inputs.js'
import { deliverNextMail, smtpMailer } from '../src/modules/notifications/mail-jobs.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must point to a dedicated local _test database.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) {
  throw new Error('Run this suite only on a dedicated local _test database with NODE_ENV=test.')
}
const config = loadConfig({
  ...process.env, DATABASE_URL: testUrl, TRUST_PROXY_HOPS: '1', RATE_KEY_SECRET: randomBytes(32).toString('hex'),
  IDEMPOTENCY_KEY_SECRET: randomBytes(32).toString('hex'), PRIVACY_NOTICE_VERSION: 'fixture-b67',
  CONTACT_NOTICE_TEXT: 'Notice fictive pour tester la prise de contact.',
  ASSISTANCE_NOTICE_TEXT: 'Notice fictive pour tester les demandes d’assistance.',
  CONTACT_ACK_EMAIL: 'true', INTAKE_NOTIFY_EMAIL: 'agency@example.invalid',
  SMTP_MODE: 'local', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'brokerage@example.invalid',
})
const database = connectPrisma(testUrl)
const suffix = randomUUID().slice(0, 8)
const phone = '+2126' + String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, '0')
const person = { profile: 'INDIVIDUAL' as const, displayName: 'Client ' + suffix, phone, email: suffix + '@example.invalid', city: 'Casablanca' }
const input = { fullName: person.displayName, phone, noticeVersion: 'fixture-b67', acknowledged: true }
const contact = { ...input, email: person.email, subject: 'Objet ' + suffix, message: '<em>Message fictif de vérification.</em>' }
const assistance = { ...input, productSlug: 'responsabilite-civile', description: 'Demande de vérification de prise en charge.' }
let base: string
let close: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let advisorId: string
let productId: string
let client: Client
let verified: Client
let contactRow: ContactMessage
let caseRow: AssistanceCase
let contractId: string
let quoteId: string

function send(path: string, method = 'GET', body?: object, headers?: Record<string, string>) {
  return fetch(base + '/api' + path, {
    method, headers: { Origin: config.PUBLIC_ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}
function submit(path: string, body: object, key = randomUUID(), source = '192.0.2.24') {
  return send(path, 'POST', body, { 'Idempotency-Key': key, 'X-Forwarded-For': source })
}
async function data<T>(response: Response, status = 200) {
  assert.equal(response.status, status)
  return await response.json() as { data: T; meta?: { limit: number; page: number; total: number } }
}
async function rejected(response: Response, status: number, code: string) {
  assert.equal(response.status, status)
  const result = await response.json() as { error: { code: string } }
  assert.equal(result.error.code, code)
}
async function signIn(role: 'ADMIN' | 'ADVISOR') {
  const email = randomUUID() + '@example.invalid'
  const password = randomToken()
  const user = await database.staffUser.create({ data: { role, displayName: 'Équipe ' + suffix, email, passwordHash: await hashPassword(password) } })
  if (role === 'ADVISOR') advisorId = user.id
  const response = await send('/auth/login', 'POST', { email, password })
  const { data: result } = await data<{ csrfToken: string }>(response)
  return { Cookie: (response.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': result.csrfToken }
}

before(async () => {
  await database.$connect()
  const server = (await createApp(database, config)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  admin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  const product = await database.insuranceProduct.upsert({
    where: { slug: 'responsabilite_civile' }, update: { isActive: true, isPublished: true },
    create: { slug: 'responsabilite_civile', title: 'Responsabilité civile', summary: 'Test de prise en charge.', isPublished: true,
      audiences: ['INDIVIDUAL'], eligibilityText: '', potentialCoverages: [], documentHints: [], faqs: [], relatedSlugs: [] },
  })
  productId = product.id
})

after(async () => {
  await close?.()
  await database.$disconnect()
})

test('staff create and edit verified customers, review duplicates and value version and CSRF checks', async () => {
  await rejected(await send('/admin/clients'), 401, 'UNAUTHENTICATED')
  await rejected(await send('/admin/clients', 'POST', person, { Cookie: advisor.Cookie }), 403, 'CSRF_FAILED')
  client = (await data<Client>(await send('/admin/clients', 'POST', person, advisor), 201)).data
  assert.equal(client.intakeProvisional, false)
  await rejected(await send('/admin/clients/' + client.id), 401, 'UNAUTHENTICATED')
  await rejected(await send('/admin/clients', 'POST', { ...person, displayName: 'Doublon ' + suffix }, advisor), 409, 'CLIENT_DUPLICATES')
  const { data: matches } = await data<{ id: string }[]>(await send('/admin/clients/duplicates', 'POST', { phone }, advisor))
  assert.ok(matches.some(item => item.id === client.id))
  assert.equal((await data<Client>(await send('/admin/clients', 'POST', { ...person, displayName: 'Fiche distincte ' + suffix, confirmDuplicate: true }, advisor), 201)).data.intakeProvisional, false)
  const path = '/admin/clients/' + client.id
  client = (await data<Client>(await send(path, 'PATCH', { version: client.version, city: 'Rabat', notes: 'Note locale.' }, advisor))).data
  assert.equal(client.city, 'Rabat')
  await rejected(await send(path, 'PATCH', { version: 1, city: 'Tanger' }, advisor), 409, 'STALE_VERSION')
  await rejected(await send(path + '/archive', 'POST', { version: client.version }, advisor), 403, 'FORBIDDEN')
  for (const q of [phone, person.email, person.displayName]) {
    const result = await data<{ id: string }[]>(await send('/admin/clients?' + new URLSearchParams({ q, profile: 'INDIVIDUAL', limit: '1' }), 'GET', undefined, admin))
    assert.equal(result.data.length, 1)
    if (q === person.displayName) assert.equal(result.data[0].id, client.id)
    else assert.equal(result.meta?.total, 2)
  }
  const first = await data<{ id: string }[]>(await send('/admin/clients?' + new URLSearchParams({ q: phone, page: '1', limit: '1' }), 'GET', undefined, advisor))
  const second = await data<{ id: string }[]>(await send('/admin/clients?' + new URLSearchParams({ q: phone, page: '2', limit: '1' }), 'GET', undefined, advisor))
  assert.notEqual(first.data[0].id, second.data[0].id)
})

test('provisional verification, quote linkage and archival preserve historical records', async () => {
  const proposed = await database.client.create({
    data: { ...person, displayName: 'Provisoire ' + suffix, email: null, phone: '+2127' + phone.slice(-8), intakeProvisional: true },
  })
  const quote = await database.quoteRequest.create({
    data: { reference: 'DEV-' + suffix, clientId: proposed.id, productId, profile: 'INDIVIDUAL', firstName: 'Test', lastName: 'Historique', phone, email: person.email,
      city: 'Casablanca', needs: 'Besoins historiques de vérification.', acknowledgedAt: new Date(), noticeVersion: 'fixture-b67' },
  })
  quoteId = quote.id
  const path = '/admin/clients/' + proposed.id
  const matches = await data<{ id: string }[]>(await send('/admin/clients?' + new URLSearchParams({ q: quote.reference, provisional: 'true' }), 'GET', undefined, advisor))
  assert.equal(matches.data[0].id, proposed.id)
  verified = (await data<Client>(await send(path, 'PATCH', { version: proposed.version, verify: true }, advisor))).data
  assert.equal(verified.intakeProvisional, false)
  const detail = await data<{ recentRequests: { id: string }[]; activity: { action: string }[] }>(await send(path, 'GET', undefined, advisor))
  assert.equal(detail.data.recentRequests[0].id, quoteId)
  assert.ok(detail.data.activity.some(event => event.action === 'CLIENT_VERIFIED'))
  await rejected(await send(path + '/archive', 'POST', { version: verified.version }, admin), 409, 'CLIENT_ARCHIVE_BLOCKED')
  const relink = await data<{ clientId: string }>(await send('/admin/quote-requests/' + quoteId, 'PATCH', { version: quote.version, clientId: client.id }, advisor))
  assert.equal(relink.data.clientId, client.id)
  verified = (await data<Client>(await send(path + '/archive', 'POST', { version: verified.version }, admin))).data
  assert.ok(verified.archivedAt)
  assert.equal((await database.quoteRequest.findUniqueOrThrow({ where: { id: quoteId } })).firstName, quote.firstName)
  await rejected(await send(path, 'PATCH', { version: verified.version, city: 'Rabat' }, admin), 409, 'CLIENT_ARCHIVED')
})

test('public contact validates, deduplicates concurrent attempts, queues mail and leaves CRM unchanged', async () => {
  const notice = await data<{ noticeVersion: string }>(await send('/contact/notice'))
  assert.equal(notice.data.noticeVersion, 'fixture-b67')
  await rejected(await submit('/contact', { ...contact, acknowledged: false }), 422, 'VALIDATION_FAILED')
  await rejected(await submit('/contact', { ...contact, email: 'bad', message: 'short' }), 422, 'VALIDATION_FAILED')
  await rejected(await submit('/contact', { ...contact, noticeVersion: 'old' }), 409, 'NOTICE_CHANGED')
  const key = randomUUID()
  const responses = await Promise.all([submit('/contact', contact, key), submit('/contact', contact, key)])
  const records = await Promise.all(responses.map(response => data<{ reference: string }>(response, 201)))
  assert.deepEqual(records[0], records[1])
  const reference = records[0].data.reference
  assert.deepEqual(Object.keys(records[0].data).sort(), ['receivedAt', 'reference'])
  contactRow = await database.contactMessage.findUniqueOrThrow({ where: { reference } })
  assert.equal(contactRow.message, contact.message)
  assert.equal(await database.outboxJob.count({ where: { messageId: contactRow.id } }), 2)
  assert.equal(await database.client.count({ where: { email: person.email } }), 2)
  await rejected(await submit('/contact', { ...contact, subject: 'Autre objet' }, key), 409, 'IDEMPOTENCY_CONFLICT')
  await rejected(await send('/contact/' + reference), 404, 'NOT_FOUND')
})

test('contact rate limit is atomic and reports Retry-After', async () => {
  const responses = await Promise.all(Array.from({ length: 11 }, () => submit('/contact', {}, randomUUID(), '192.0.2.61')))
  assert.equal(responses.filter(response => response.status === 422).length, 10)
  assert.ok(Number(responses.find(response => response.status === 429)?.headers.get('retry-after')) > 0)
})

test('staff search, change read state, process and archive messages with versioned audit', async () => {
  const path = '/admin/messages/' + contactRow.id
  await rejected(await send(path), 401, 'UNAUTHENTICATED')
  await rejected(await send(path, 'PATCH', { version: 1, status: 'READ' }, { Cookie: advisor.Cookie }), 403, 'CSRF_FAILED')
  await rejected(await send(path + '/archive', 'POST', { version: 1 }, advisor), 409, 'INVALID_TRANSITION')
  const result = await data<{ id: string; phone?: string }[]>(await send('/admin/messages?' + new URLSearchParams({
    q: contact.subject, from: casablancaDate(), to: casablancaDate(), status: 'UNREAD',
  }), 'GET', undefined, advisor))
  assert.equal(result.data[0].id, contactRow.id)
  assert.equal(result.data[0].phone, undefined)
  for (const [version, status] of [[1, 'READ'], [2, 'UNREAD'], [3, 'PROCESSED']] as const) {
    assert.equal((await data<ContactMessage>(await send(path, 'PATCH', { version, status }, advisor))).data.status, status)
  }
  await rejected(await send(path, 'PATCH', { version: 3, status: 'READ' }, advisor), 409, 'STALE_VERSION')
  await rejected(await send(path, 'PATCH', { version: 4, status: 'READ' }, advisor), 409, 'INVALID_TRANSITION')
  assert.ok((await data<ContactMessage>(await send(path + '/archive', 'POST', { version: 4 }, advisor))).data.archivedAt)
  const archive = await data<{ id: string }[]>(await send('/admin/messages?archived=true&q=' + contactRow.reference, 'GET', undefined, admin))
  assert.equal(archive.data[0].id, contactRow.id)
  assert.equal(await database.auditEvent.count({ where: { targetId: contactRow.id, action: 'CONTACT_ARCHIVED' } }), 1)
})

test('public assistance treats all contract references as unverified, checks product and deduplicates alerts', async () => {
  const partner = await database.partner.create({ data: { name: 'Partenaire test ' + suffix } })
  const contract = await database.contract.create({
    data: { reference: 'CTR-' + suffix, clientId: client.id, productId, partnerId: partner.id, policyNumber: 'Police ' + suffix,
      effectiveOn: new Date('2026-01-01'), expiresOn: new Date('2027-01-01'), status: 'ACTIVE' },
  })
  contractId = contract.id
  await rejected(await submit('/assistance', { ...assistance, productSlug: 'invalid' }), 422, 'VALIDATION_FAILED')
  await rejected(await submit('/assistance', { ...assistance, phone: 'bad' }), 422, 'VALIDATION_FAILED')
  await rejected(await submit('/assistance', { ...assistance, email: contact.email }), 422, 'VALIDATION_FAILED')
  await database.insuranceProduct.update({ where: { id: productId }, data: { isPublished: false } })
  await rejected(await submit('/assistance', assistance), 409, 'PRODUCT_UNAVAILABLE')
  await database.insuranceProduct.update({ where: { id: productId }, data: { isPublished: true } })
  const key = randomUUID()
  const body = { ...assistance, contractReference: contract.reference }
  const { data: receipt } = await data<{ reference: string }>(await submit('/assistance', body, key), 201)
  const replay = await data<{ reference: string }>(await submit('/assistance', body, key), 201)
  assert.deepEqual(replay.data, receipt)
  const unknown = await data<{ reference: string }>(await submit('/assistance', { ...body, contractReference: 'INCONNUE-' + suffix }), 201)
  assert.notEqual(unknown.data.reference, receipt.reference)
  caseRow = await database.assistanceCase.findUniqueOrThrow({ where: { reference: receipt.reference } })
  assert.equal(caseRow.contractReference, contract.reference)
  assert.equal(caseRow.contractId, null)
  assert.equal(caseRow.clientId, null)
  assert.equal(await database.outboxJob.count({ where: { caseId: caseRow.id, kind: 'ASSISTANCE_ALERT' } }), 1)
})

test('staff assistance requires verified links, preserves source data and supports assignment, notes and lifecycle', async () => {
  const path = '/admin/assistance/' + caseRow.id
  await rejected(await send(path), 401, 'UNAUTHENTICATED')
  await rejected(await send(path, 'PATCH', { version: 1, status: 'IN_PROGRESS' }, { Cookie: advisor.Cookie }), 403, 'CSRF_FAILED')
  await rejected(await send(path, 'PATCH', { version: 1, clientId: verified.id }, admin), 422, 'VALIDATION_FAILED')
  await rejected(await send(path, 'PATCH', { version: 1, contractId }, advisor), 422, 'CONTRACT_MISMATCH')
  const provisional = await database.client.create({ data: { ...person, intakeProvisional: true, email: null, displayName: 'Non vérifié ' + suffix } })
  await rejected(await send(path, 'PATCH', { version: 1, clientId: provisional.id }, advisor), 422, 'CLIENT_UNVERIFIED')
  const options = await data<{ id: string }[]>(await send(path + '/contract-options?clientId=' + client.id, 'GET', undefined, advisor))
  assert.equal(options.data[0].id, contractId)
  caseRow = (await data<AssistanceCase>(await send(path, 'PATCH', {
    version: 1, assignedTo: advisorId, clientId: client.id, contractId, status: 'IN_PROGRESS', priority: 'URGENT',
  }, advisor))).data
  assert.equal(caseRow.assignedTo, advisorId)
  assert.equal(caseRow.contractId, contractId)
  await rejected(await send(path, 'PATCH', { version: caseRow.version, status: 'NEW' }, advisor), 409, 'INVALID_TRANSITION')
  await rejected(await send(path, 'PATCH', { version: 1, status: 'RESOLVED' }, advisor), 409, 'STALE_VERSION')
  await rejected(await send('/admin/clients/' + client.id + '/archive', 'POST', { version: client.version }, admin), 409, 'CLIENT_ARCHIVE_BLOCKED')
  const note = await data<{ notes: { body: string }[]; version: number }>(await send(path + '/notes', 'POST', { version: caseRow.version, body: 'Note interne fictive.' }, advisor), 201)
  assert.equal(note.data.notes[0].body, 'Note interne fictive.')
  const list = await data<{ id: string }[]>(await send('/admin/assistance?' + new URLSearchParams({
    q: caseRow.reference, status: 'IN_PROGRESS', assignedTo: advisorId, priority: 'URGENT', productSlug: assistance.productSlug,
  }), 'GET', undefined, advisor))
  assert.equal(list.data[0].id, caseRow.id)
  const profile = await data<{ recentAssistance: { id: string }[] }>(await send('/admin/clients/' + client.id, 'GET', undefined, advisor))
  assert.equal(profile.data.recentAssistance[0].id, caseRow.id)
  assert.equal((await data<AssistanceCase>(await send(path, 'PATCH', { version: note.data.version, status: 'RESOLVED' }, admin))).data.status, 'RESOLVED')
  assert.equal(await database.auditEvent.count({ where: { targetId: caseRow.id, action: 'ASSISTANCE_NOTE_ADDED' } }), 1)
})

test('dashboard reports support and verification totals, and SMTP failures leave cases intact', async () => {
  const dashboard = await data<{ counts: Record<string, number>; activity: { targetId: string }[] }>(await send('/admin/dashboard', 'GET', undefined, advisor))
  assert.equal(dashboard.data.counts.totalClients, await database.client.count())
  assert.equal(dashboard.data.counts.provisionalClients, await database.client.count({ where: { intakeProvisional: true, archivedAt: null } }))
  assert.equal(dashboard.data.counts.newAssistance, await database.assistanceCase.count({ where: { status: 'NEW' } }))
  assert.equal(dashboard.data.counts.inReviewAssistance, await database.assistanceCase.count({ where: { status: 'IN_PROGRESS' } }))
  assert.equal(dashboard.data.counts.unreadMessages, await database.contactMessage.count({ where: { status: 'UNREAD' } }))
  assert.ok(dashboard.data.activity.some(event => event.targetId === caseRow.id))

  const socket = createServer().listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const smtp = { ...config, SMTP_PORT: (socket.address() as AddressInfo).port }
  await new Promise<void>(resolve => socket.close(() => resolve()))
  const mailer = smtpMailer(smtp)
  assert.ok(mailer)
  try {
    const job = await database.outboxJob.findFirstOrThrow({ where: { caseId: caseRow.id } })
    for (let i = 0; i < 100; i++) {
      const current = await database.outboxJob.findUniqueOrThrow({ where: { id: job.id } })
      if (current.lastErrorCode === 'SMTP_RETRY' || !await deliverNextMail(database, smtp, mailer)) break
    }
    assert.equal((await database.outboxJob.findUniqueOrThrow({ where: { id: job.id } })).lastErrorCode, 'SMTP_RETRY')
    assert.ok(await database.assistanceCase.findUnique({ where: { id: caseRow.id } }))
  } finally {
    mailer.close()
  }
})
