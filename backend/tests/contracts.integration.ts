import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import type { SendMailOptions } from 'nodemailer'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { casablancaDate } from '../src/modules/business-inputs.js'
import { addDays, onDate } from '../src/modules/contracts/model.js'
import { deliverNextRenewal, maintainContracts, scheduleReminders } from '../src/modules/contracts/reminders.js'
import type { Mailer } from '../src/modules/notifications/mail-jobs.js'
import type { QuoteSnapshot } from '../src/modules/quotes/model.js'
import { renderQuotePdf } from '../src/modules/quotes/pdf.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must use a dedicated local _test database.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) throw new Error('Test database required.')
const folder = await mkdtemp(join(tmpdir(), 'zc-contract-test-'))
const config = loadConfig({
  ...process.env, DATABASE_URL: testUrl, QUOTE_PDF_DIR: folder, RATE_KEY_SECRET: randomBytes(32).toString('hex'),
  SMTP_MODE: 'local', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'broker@example.invalid',
  RENEWAL_NOTIFY_EMAIL: 'renewals@example.invalid', RENEWAL_REMINDER_DAYS: '30,15,7,1',
})
const db = connectPrisma(testUrl)
const today = casablancaDate()
const expiresOn = addDays(today, 45)
const marker = randomUUID().slice(0, 8)
const mail: SendMailOptions[] = []
const successful = { sendMail: async (message: SendMailOptions) => { mail.push(message); return { accepted: ['accepted'] } } } as unknown as Mailer
const failing = { sendMail: async () => { throw new Error('Synthetic mail failure') } } as unknown as Mailer
const confirmation = { status: 'ACTIVE', confirmationOn: today, confirmationReference: 'CONFIRMATION-' + marker }
type Result = {
  id: string; reference: string; status: string; version: number; premiumMad: string;
  confirmed: boolean; previousId: string; renewed: boolean; confirmationReference: string;
  sourceQuoteSnapshot: { version: number; total: string }; documents: { id: string; revision: number }[];
  reminders: { id: string; days: number; status: string }[]; activity: { action: string }[];
  cancellationReason: string;
}
let origin: string
let close: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let customerId: string
let productId: string
let partnerId: string
let quoteId: string
let policy: Result
let future: Result
let document: { id: string; revision: number }
let bytes: Buffer

const productSlug = 'habitation'
const snapshot: QuoteSnapshot = {
  reference: 'DV-' + marker, revision: 1, issuedOn: today, validUntil: addDays(today, 10), clientName: 'Client synthétique ' + marker,
  city: 'Rabat', email: 'fixture@example.invalid', product: 'Habitation', carrier: 'Compagnie synthétique',
  coverage: 'Garantie synthétique de vérification', limits: 'Limites de test', deductibles: null, conditions: 'Conditions de test',
  customerNotes: null, premium: '1000.25', fees: '10.20', taxes: '0.09', total: '1010.54', development: true,
}
function call(path: string, method = 'GET', body?: object, headers: Record<string, string> = {}) {
  return fetch(origin + '/api' + path, {
    method, headers: { Origin: config.PUBLIC_ORIGIN, ...(body && { 'Content-Type': 'application/json' }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}
async function data<T=Result>(response: Response, status = 200) {
  assert.equal(response.status, status)
  return (await response.json() as { data: T }).data
}
const draftTerm = { effectiveOn: today, expiresOn }
function externalDraft(overrides = {}) {
  return call('/admin/contracts/external', 'POST', {
    ...draftTerm, clientId: customerId, partnerId, productSlug, coverage: snapshot.coverage, premiumMad: '1210.25', ...overrides,
  }, advisor)
}
function registryAction(row: Result, endpoint: string, payload: object, headers = admin) {
  return call('/admin/contracts/' + row.id + '/' + endpoint, 'POST', { version: row.version, ...payload }, headers)
}
function upload(row: Result, file: Buffer, type = 'application/pdf', headers = advisor) {
  return fetch(origin + '/api/admin/contracts/' + row.id + '/documents?version=' + row.version, {
    method: 'POST', headers: { Origin: config.PUBLIC_ORIGIN, 'Content-Type': type, ...headers },
    body: new Uint8Array(file),
  })
}
async function signIn(role: 'ADMIN' | 'ADVISOR') {
  const email = randomUUID()+'@example.invalid'
  const password = randomToken()
  await db.staffUser.create({ data: { role, displayName: 'Test contrats', email, passwordHash: await hashPassword(password) } })
  const response = await call('/auth/login', 'POST', { email, password })
  const { csrfToken } = await data<{ csrfToken: string }>(response)
  return { Cookie: (response.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': csrfToken }
}

before(async () => {
  await db.$connect()
  const server = (await createApp(db, config)).listen(0, '127.0.0.1')
  await once(server,'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
  admin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  productId = (await db.insuranceProduct.upsert({
    where: { slug: productSlug }, update: {}, create: {
      slug: productSlug, title: 'Habitation', summary: 'Test de contrat.', audiences: ['INDIVIDUAL'],
      eligibilityText: '', potentialCoverages: [], documentHints: [], faqs: [], relatedSlugs: [],
    },
  })).id
  const customer = await db.client.create({ data: { displayName: snapshot.clientName, profile: 'INDIVIDUAL', phone: '+212600002599' } })
  customerId = customer.id
  partnerId = (await db.partner.create({ data: { name: 'Compagnie synthétique ' + marker } })).id
  quoteId = (await db.quote.create({ data: {
    clientId: customerId, productId, partnerId, reference: snapshot.reference, annualPremiumMad: snapshot.premium,
    feesMad: snapshot.fees, taxesMad: snapshot.taxes, totalMad: snapshot.total,
    status: 'ACCEPTED', version: 3, sentAt: new Date(), decidedAt: new Date(), issuedAt: new Date(), validUntil: onDate(snapshot.validUntil), issuedSnapshot: snapshot,
  } })).id
  bytes = await renderQuotePdf(snapshot)
})

after(async () => {
  await close?.()
  await db.$disconnect()
  await rm(folder, { recursive: true, force: true })
})

test('accepted-quote conversion validates version, permissions and links and creates one draft atomically', async () => {
  const payload = { ...draftTerm, quoteId, quoteVersion: 3 }
  assert.equal((await call('/admin/contracts', 'POST', payload)).status, 401)
  assert.equal((await call('/admin/contracts', 'POST', payload, { Cookie: advisor.Cookie })).status, 403)
  assert.equal((await call('/admin/contracts', 'POST', { ...payload, quoteVersion: 1 }, advisor)).status, 409)
  assert.equal((await call('/admin/contracts', 'POST', { ...payload, clientId: randomUUID() }, advisor)).status, 422)
  for (const status of ['DRAFT', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const) {
    await db.quote.update({ where: { id: quoteId }, data: { status } })
    assert.equal((await call('/admin/contracts', 'POST', payload, advisor)).status, 409)
  }
  await db.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED', validUntil: onDate(addDays(today, -1)) } })
  assert.equal((await call('/admin/contracts', 'POST', payload, advisor)).status, 409)
  await db.quote.update({ where: { id: quoteId }, data: { validUntil: onDate(snapshot.validUntil) } })
  await db.partner.update({ where: { id: partnerId }, data: { isActive: false } })
  assert.equal((await call('/admin/contracts', 'POST', payload, advisor)).status, 409)
  await db.partner.update({ where: { id: partnerId }, data: { isActive: true } })
  await db.client.update({ where: { id: customerId }, data: { intakeProvisional: true } })
  assert.equal((await call('/admin/contracts', 'POST', payload, advisor)).status, 409)
  await db.client.update({ where: { id: customerId }, data: { intakeProvisional: false } })
  const results = await Promise.all([call('/admin/contracts', 'POST', payload, advisor), call('/admin/contracts', 'POST', payload, advisor)])
  assert.deepEqual(results.map(response => response.status).sort(), [201, 409])
  policy = await data(results.find(response => response.status === 201)!, 201)
  assert.equal(policy.status, 'DRAFT')
  assert.equal(policy.premiumMad, '1010.54')
  assert.equal(policy.sourceQuoteSnapshot.version, 3)
  assert.equal(policy.sourceQuoteSnapshot.total, '1010.54')
  assert.equal((await call('/admin/contracts/' + policy.id)).status, 401)
})

test('draft edits, written confirmation and future or elapsed periods have distinct states', async () => {
  assert.equal((await registryAction(policy, 'status', confirmation, advisor)).status, 403)
  assert.equal((await registryAction(policy, 'status', { status:'ACTIVE' })).status, 422)
  assert.equal((await registryAction(policy, 'status', confirmation)).status, 409)
  const path = '/admin/contracts/' + policy.id
  assert.equal((await call(path,'PATCH',{version:policy.version, expiresOn:today},advisor)).status,422)
  assert.equal((await call(path,'PATCH',{version:policy.version,premiumMad:1.50},advisor)).status,422)
  const registered = { policyNumber: 'POLICY-' + marker, premiumMad: '1990.07', coverage: 'Police synthétique confirmée pour la vérification.' }
  policy = await data(await call(path, 'PATCH', { version: policy.version, ...registered }, advisor))
  assert.equal(policy.premiumMad, '1990.07')
  assert.equal((await registryAction(policy, 'status', { ...confirmation, confirmationOn: addDays(today,1) })).status,409)
  policy = await data(await registryAction(policy, 'status', confirmation), 202)
  assert.equal(policy.status, 'ACTIVE')
  assert.equal(policy.confirmationReference, confirmation.confirmationReference)
  assert.deepEqual(policy.reminders.map(job=>job.days), [30,15,7,1])
  const row = await db.contract.findUniqueOrThrow({ where: { id: policy.id } })
  await scheduleReminders(db,row,config)
  assert.equal(await db.outboxJob.count({where:{contractId:policy.id}}),4)
  assert.equal((await call(path,'PATCH',{version:policy.version,premiumMad:'1.25'},admin)).status,409)
  assert.equal((await externalDraft({policyNumber:registered.policyNumber})).status,409)
  future = await data(await externalDraft({ policyNumber:'FUTURE-'+marker, effectiveOn:addDays(today,1), renewalReminders:false }),201)
  future = await data(await registryAction(future,'status',confirmation),202)
  assert.equal(future.status,'SCHEDULED')
  assert.equal(future.reminders.length,0)
  let ended = await data(await externalDraft({ policyNumber:'ENDED-'+marker, effectiveOn:addDays(today,-5), expiresOn:today }),201)
  assert.equal((await registryAction(ended,'status',confirmation)).status,409)
  ended = await data(await registryAction(ended,'status',{ status:'CANCELLED',reason:'Vérification historique.' }))
  assert.equal(ended.status,'CANCELLED')
})

test('the authenticated contract upload validates file type, signatures, size and integrity', async () => {
  assert.equal((await upload(policy,bytes,'text/plain')).status,415)
  assert.equal((await upload(policy,Buffer.from('not a policy file'))).status,422)
  assert.equal((await upload(policy,Buffer.alloc(4*1024*1024+1))).status,413)
  assert.equal((await upload(policy,bytes,'application/pdf',{Cookie:advisor.Cookie})).status,403)
  const malicious = Buffer.from(bytes.toString('latin1').replace('/Type /Catalog', '/AA /Catalog'),'latin1')
  assert.equal((await upload(policy,malicious)).status,422)
  policy = await data(await upload(policy,bytes),201)
  document=policy.documents[0]
  assert.equal(document.revision,1)
  const path='/admin/documents/'+document.id+'/download'
  assert.equal((await call(path)).status,401)
  assert.equal((await call(path+'?inline=true','GET',undefined,advisor)).status,404)
  assert.equal((await call('/admin/documents/%2e%2e%2fpolicy.pdf/download','GET',undefined,advisor)).status,404)
  const response=await call(path,'GET',undefined,advisor)
  assert.match(response.headers.get('content-disposition')??'',/^attachment; filename="CTR-[A-F0-9]+-piece-1.pdf"$/)
  assert.equal(response.headers.get('cache-control'),'no-store')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes)
  const stored=await db.document.findUniqueOrThrow({where:{id:document.id}})
  await writeFile(join(folder,stored.storageKey!),Buffer.concat([bytes,Buffer.from('tampered')]))
  assert.equal((await call(path,'GET',undefined,advisor)).status,503)
  await writeFile(join(folder,stored.storageKey!),bytes)
})

test('private CRM history and verified assistance linkage show the real contract', async () => {
  const assistance = await db.assistanceCase.create({data:{
    productId, reference:'ASS-'+marker, fullName:'Demandeur synthétique', phone:'+212600003333',
    description:'Vérification synthétique de contrat.', contractReference:'Unverified-'+marker, noticeVersion:'contract-test', acknowledgedAt:new Date(),
  }})
  assert.equal((await call('/admin/assistance/'+assistance.id)).status,401)
  const options=await data<{id:string;status:string}[]>(await call('/admin/assistance/'+assistance.id+'/contract-options?clientId='+customerId,'GET',undefined,advisor))
  assert.ok(options.some(row=>row.id===policy.id&&row.status==='ACTIVE'))
  const result=await data<{contract:{id:string;status:string};contractReference:string}>(await call('/admin/assistance/'+assistance.id,'PATCH',{version:1,clientId:customerId,contractId:policy.id},advisor))
  assert.equal(result.contract.id,policy.id)
  assert.equal(result.contract.status,'ACTIVE')
  assert.equal(result.contractReference,'Unverified-'+marker)
  const client=await data<{recentContracts:{id:string;quoteId:string}[]}>(await call('/admin/clients/'+customerId,'GET',undefined,advisor))
  assert.ok(client.recentContracts.some(row=>row.id===policy.id&&row.quoteId===quoteId))
  const dashboard=await data<{contractCounts:{active:number;scheduled:number};recentContracts:{id:string}[]}>(await call('/admin/dashboard','GET',undefined,advisor))
  assert.ok(dashboard.contractCounts.active>=1&&dashboard.contractCounts.scheduled>=1)
  assert.ok(dashboard.recentContracts.some(row=>row.id===policy.id))
  const filtered=await data<{id:string}[]>(await call('/admin/contracts?'+new URLSearchParams({
    q:policy.reference,status:'ACTIVE',productSlug,partnerId,expiresTo:expiresOn,expiresFrom:expiresOn,limit:'1',
  }),'GET',undefined,advisor))
  assert.equal(filtered[0].id,policy.id)
})

test('renewal is a separate draft and confirmation obsoletes predecessor reminders without changing policy or files', async () => {
  const before = await db.contract.findUniqueOrThrow({ where: { id:policy.id } })
  assert.equal((await registryAction(policy,'renew',{effectiveOn:today,expiresOn:addDays(today,90)},advisor)).status,409)
  const next = await data(await registryAction(policy,'renew',{effectiveOn:expiresOn,expiresOn:addDays(today,410)},advisor),201)
  assert.equal(next.previousId,policy.id)
  assert.equal(next.status,'DRAFT')
  assert.equal(next.confirmed,false)
  assert.equal((await registryAction(policy,'renew',{effectiveOn:expiresOn,expiresOn:addDays(today,410)},advisor)).status,409)
  assert.deepEqual(await db.contract.findUniqueOrThrow({where:{id:policy.id}}), before)
  const changed = await data(await call('/admin/contracts/'+next.id,'PATCH',{version:next.version,policyNumber:'RENEWAL-'+marker,premiumMad:'2010.25'},advisor))
  const accepted = await data(await registryAction(changed,'status',confirmation),202)
  assert.equal(accepted.status,'SCHEDULED')
  assert.deepEqual(await db.contract.findUniqueOrThrow({where:{id:policy.id}}), before)
  policy = await data(await call('/admin/contracts/'+policy.id,'GET',undefined,advisor))
  assert.equal(policy.renewed,true)
  assert.ok(policy.reminders.every(job=>job.status==='OBSOLETE'))
  assert.deepEqual(Buffer.from(await (await call('/admin/documents/'+document.id+'/download','GET',undefined,advisor)).arrayBuffer()),bytes)
  assert.ok(policy.activity.some(row=>row.action==='CONTRACT_RENEWAL_PREPARED'))
})

test('worker coalesces missed windows, retries and cancels obsolete or expired reminders', async () => {
  let pending = await data(await externalDraft({policyNumber:'DOWNTIME-'+marker,expiresOn:addDays(today,2)}),201)
  pending = await data(await registryAction(pending,'status',confirmation),202)
  const row=await db.contract.findUniqueOrThrow({where:{id:pending.id}})
  await scheduleReminders(db,row,config,onDate(addDays(today,-80)))
  for (let index=0;index<3;index++) assert.equal(await deliverNextRenewal(db,config,failing),true)
  const jobs=await db.outboxJob.findMany({where:{contractId:pending.id}})
  assert.equal(jobs.find(job=>job.reminderDays===30)?.lastErrorCode,'RENEWAL_OBSOLETE')
  assert.equal(jobs.find(job=>job.reminderDays===15)?.lastErrorCode,'RENEWAL_OBSOLETE')
  const retry=jobs.find(job=>job.reminderDays===7)!
  assert.equal(retry.state,'PENDING')
  assert.equal(retry.lastErrorCode,'RENEWAL_SMTP_FAILED')
  await db.outboxJob.update({where:{id:retry.id},data:{nextAttemptAt:new Date()}})
  assert.equal(await deliverNextRenewal(db,config,successful),true)
  assert.equal(mail.length,1)
  assert.deepEqual(mail[0].to,{name:'',address:config.RENEWAL_NOTIFY_EMAIL})
  assert.ok(mail[0].text?.toString().includes(pending.reference))
  assert.equal(await deliverNextRenewal(db,config,successful),false)
  assert.equal((await registryAction(pending,'status',{status:'CANCELLED'})).status,422)
  assert.equal((await registryAction(pending,'status',{status:'CANCELLED',reason:'Annulation fictive.'},advisor)).status,403)
  pending=await data(await registryAction(pending,'status',{status:'CANCELLED',reason:'Annulation fictive.'}))
  assert.equal(pending.cancellationReason,'Annulation fictive.')
  assert.equal(pending.reminders.find(job=>job.days===1)?.status,'OBSOLETE')
  assert.equal(await db.auditEvent.count({where:{targetId:pending.id, action:'CONTRACT_CANCELLED'}}),1)

  let expiry=await data(await externalDraft({policyNumber:'EXPIRES-'+marker,expiresOn:addDays(today,4)}),201)
  expiry=await data(await registryAction(expiry,'status',confirmation),202)
  // A mismatched term never sends an old reminder, including after an operator correction.
  await db.contract.update({where:{id:expiry.id},data:{expiresOn:onDate(addDays(today,3))}})
  await maintainContracts(db)
  assert.equal(await db.outboxJob.count({where:{contractId:expiry.id,state:'PENDING'}}),0)
  await maintainContracts(db,onDate(addDays(today,3)))
  assert.equal((await db.contract.findUniqueOrThrow({where:{id:expiry.id}})).status,'EXPIRED')
  assert.equal(await db.auditEvent.count({where:{targetId:expiry.id,action:'CONTRACT_EXPIRED'}}),1)
})
