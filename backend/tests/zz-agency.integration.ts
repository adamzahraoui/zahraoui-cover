import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
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
import { deliverNextMail } from '../src/modules/notifications/mail-jobs.js'
import type { Mailer } from '../src/modules/notifications/mail-jobs.js'
import { generateNextQuotePdf } from '../src/modules/quotes/jobs.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error('Test database required.')
const u = new URL(url)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(u.pathname) || url === process.env.PRODUCTION_DATABASE_URL) throw new Error('Use an isolated test database.')
const db = connectPrisma(url)
const dir = await mkdtemp(join(tmpdir(), 'zc-agency-'))
const config = loadConfig({ ...process.env, DATABASE_URL: url, QUOTE_PDF_DIR: dir, RATE_KEY_SECRET: randomBytes(32).toString('hex'),
  IDEMPOTENCY_KEY_SECRET: randomBytes(32).toString('hex'),
  SMTP_MODE: 'local', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'fixture@example.invalid' })
let origin: string
let close: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let settings: { version: number }
let primaryAdminId: string
let notices: { id: string; version: number }[]
let clientId: string
let partnerId: string
let productId: string
const mark = randomUUID().slice(0, 8)
const date = casablancaDate()
const today = new Date()
const mail: SendMailOptions[] = []
const mailer = { sendMail: async (message: SendMailOptions) => { mail.push(message); return { accepted: ['test'] } } } as unknown as Mailer
type Legal = { id: string; version: number; publishedAt: string | null; body: string }
const privateRecipient = 'bureau-' + mark + '@example.invalid'
const publicEmail = 'public-' + mark + '@example.invalid'

function call(path: string, method = 'GET', input?: object, headers: Record<string, string> = admin) {
  return fetch(origin + '/api' + path, { method, headers: { Origin: config.PUBLIC_ORIGIN,
    ...(input && { 'Content-Type': 'application/json' }), ...headers }, body: input ? JSON.stringify(input) : undefined })
}

async function data<T>(response: Response, status = 200): Promise<T> {
  assert.equal(response.status, status, await response.clone().text())
  return (await response.json() as { data: T }).data
}

async function login(email: string, password: string) {
  const result = await call('/auth/login','POST',{email,password},{})
  const session = await data<{csrfToken:string}>(result)
  return { Cookie: (result.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': session.csrfToken }
}

async function user(role: 'ADMIN' | 'ADVISOR') {
  const email = randomUUID() + '@example.invalid'
  const password = randomToken()
  const user = await db.staffUser.create({ data: { email, passwordHash: await hashPassword(password), displayName: 'Équipe de vérification', role } })
  return { id: user.id, headers: await login(email, password) }
}

async function publish(kind: string, body: string) {
  const draft = await data<Legal>(await call('/admin/settings/content','POST',{ kind, body }),201)
  return await data<Legal>(await call('/admin/settings/content/'+draft.id+'/publish','POST',{version:draft.version,approved:true}))
}

function managed(days: number[], version = settings.version, renewal = true) {
  return call('/admin/settings/notifications','PATCH',{
    version, reminderDays: days, notifications: {
      quote: { enabled:false, recipient:null }, assistance: { enabled:false, recipient:null }, contact: { enabled:true, recipient:privateRecipient },
      renewal: { enabled:renewal, recipient:privateRecipient }, quoteAcknowledgement:false, contactAcknowledgement:false,
    },
  })
}
const contactBody = (noticeVersion: string) => ({ fullName:'Client synthétique', phone:'+212600002402', email:'client-'+mark+'@example.invalid',
  subject:'Vérification', message:'Message synthétique pour la vérification.', noticeVersion, acknowledged:true })

before(async () => {
  await db.$connect()
  const server = (await createApp(db,config)).listen(0,'127.0.0.1')
  await once(server,'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()))
  const main = await user('ADMIN')
  primaryAdminId = main.id
  admin = main.headers
  advisor = (await user('ADVISOR')).headers
  const product = await db.insuranceProduct.upsert({ where: { slug:'habitation' }, update: {}, create: {
    slug:'habitation', title:'Assurance habitation', summary:'Contrôle synthétique.', audiences:['INDIVIDUAL'],
    eligibilityText:'', potentialCoverages:[], documentHints:[], faqs:[], relatedSlugs:[],
  } })
  productId = product.id
  const partner = await db.partner.create({ data: { name:'Compagnie de vérification ' + mark,
    categories:['habitation'], isActive:true, verifiedAt:new Date(), verificationReference:'Test B13' } })
  partnerId = partner.id
  const client = await db.client.create({ data: { displayName:'Client de vérification ' + mark, profile:'INDIVIDUAL',
    phone:'+212600002011', email:'contract-'+mark+'@example.invalid' } })
  clientId = client.id
})

after(async () => {
  await close?.()
  await db.$disconnect()
  await rm(dir,{recursive:true,force:true})
})

test('public company projection and administrative writes validate approval, permissions, CSRF and version', async () => {
  assert.equal((await call('/admin/settings','GET',undefined,{})).status,401)
  assert.equal((await call('/admin/settings','GET',undefined,advisor)).status,403)
  const unreviewed = 'unreviewed-' + mark + '@example.invalid'
  await db.agencySettings.update({ where: { id: 1 }, data: { email: unreviewed } })
  const preapproval = await data<{email:string}>(await call('/admin/settings'))
  assert.equal(preapproval.email, unreviewed)
  assert.equal((await data<{email:string|null}>(await call('/agency','GET',undefined,{}))).email, null)
  settings = await data(await call('/admin/settings'))
  const path = '/admin/settings'
  for (const fields of [{ officePhone:'123' },{ website:'javascript:alert(1)' },{ email:'non valide' },{ SMTP_PASSWORD:'test' },{ brandAsset:'fake-image' },{ approved:false }]) {
    assert.equal((await call(path,'PATCH',{version:settings.version,approved:true,...fields})).status,422)
  }
  assert.equal((await call(path,'PATCH',{version:settings.version,approved:true,city:'Rabat'}, {Cookie:admin.Cookie})).status,403)
  const version = settings.version
  settings = await data(await call(path,'PATCH',{version,approved:true,email:publicEmail,city:'Fès',legalName:'Agence synthétique B13'}))
  assert.equal((await call(path,'PATCH',{version,approved:true,city:'Rabat'})).status,409)
  const publicInfo = await data<Record<string,unknown>>(await call('/agency','GET',undefined,{}))
  assert.equal(publicInfo.agencyName,'Zahraoui Cover')
  assert.equal(publicInfo.officePhone,'+212523281585')
  assert.equal(publicInfo.assistancePhone,'+212522542323')
  assert.equal(publicInfo.email,publicEmail)
  for (const key of ['version','activity','notifications','brandAsset','reminderDays','publicApprovedAt']) assert.equal(key in publicInfo,false)
})

test('publish freezes the notice text and stale notices do not replace an earlier acknowledgement', async () => {
  const first = 'Première notice synthétique approuvée de confidentialité.'
  const next = 'Seconde notice synthétique approuvée de confidentialité.'
  const draft = await data<Legal>(await call('/admin/settings/content','POST',{ kind:'PRIVACY',body:first }),201)
  assert.equal(draft.publishedAt,null)
  assert.notEqual((await data<{text:string}>(await call('/contact/notice','GET',undefined,{}))).text,first)
  assert.equal((await call('/admin/settings/content/'+draft.id+'/publish','POST',{version:draft.version,approved:true},advisor)).status,403)
  const one = await data<Legal>(await call('/admin/settings/content/'+draft.id+'/publish','POST',{version:draft.version,approved:true}))
  const noticeVersion = one.id.replaceAll('-','')
  const key = randomUUID()
  const send = (version:string, idempotency = randomUUID()) => call('/contact','POST',contactBody(version),{'Idempotency-Key':idempotency})
  const old = await data<{reference:string}>(await send(noticeVersion,key),201)
  const second = await publish('PRIVACY',next)
  notices = [one, second]
  assert.equal((await send(noticeVersion)).status,409)
  assert.equal((await data<{reference:string}>(await send(noticeVersion,key),201)).reference,old.reference)
  const stored = await db.contactMessage.findUniqueOrThrow({ where:{reference:old.reference} })
  assert.equal(stored.noticeVersion,noticeVersion)
  assert.equal(stored.noticeText,first)
  assert.equal((await call('/admin/settings/content/'+one.id,'PATCH',{version:one.version,body:next})).status,409)
  await assert.rejects(db.agencyContent.update({where:{id:one.id},data:{body:next}}))
})

test('local notifications use the approved recipient and wording without exposing either publicly', async () => {
  await publish('EMAIL','Instruction synthétique validée pour la messagerie locale.')
  settings = await data(await managed([30,15,7,1]))
  const current = notices[1].id.replaceAll('-','')
  const result = await data<{reference:string}>(await call('/contact','POST',contactBody(current),{'Idempotency-Key':randomUUID()}),201)
  const message = await db.contactMessage.findUniqueOrThrow({where:{reference:result.reference}})
  const jobs = await db.outboxJob.findMany({where:{messageId:message.id}})
  assert.deepEqual(jobs.map(job=>job.kind),['CONTACT_ALERT'])
  for (let i=0; i<40 && !mail.some(item=>item.to===privateRecipient); i++) await deliverNextMail(db,config,mailer)
  const delivered = mail.find(item=>item.to===privateRecipient)
  assert.ok(delivered)
  assert.match(String(delivered.text),/Instruction synthétique validée/)
  assert.doesNotMatch(JSON.stringify(await data(await call('/agency','GET',undefined,{}))), new RegExp(privateRecipient))
})

test('renewal settings reconcile active terms without duplicating delivered windows or reviving cancelled policies', async () => {
  const createContract = (state: 'ACTIVE' | 'CANCELLED') => db.contract.create({data:{
    clientId,productId,partnerId,reference:'CTR-'+randomUUID().slice(0,24),policyNumber:'POL-'+randomUUID().slice(0,22),
    effectiveOn:onDate(date),expiresOn:onDate(addDays(date,32)),status:state,confirmationOn:onDate(date),confirmationReference:'CONF-VERIFY',activatedAt:today,renewalReminders:true,
    ...(state==='CANCELLED' ? { cancelledAt:today,cancellationReason:'Test' } : {}),
  }})
  const contract = await createContract('ACTIVE')
  const cancelled = await createContract('CANCELLED')
  const key=(day:number)=>'renewal:'+contract.id+':'+addDays(date,32)+':'+day
  await db.outboxJob.create({data:{kind:'RENEWAL_ALERT',contractId:contract.id,reminderExpiresOn:contract.expiresOn,reminderDays:30,
    dedupeKey:key(30),state:'SUCCEEDED',finishedAt:today,nextAttemptAt:today}})
  assert.equal((await managed([15,15])).status,422)
  settings = await data(await managed([30,20,10]))
  assert.deepEqual((await db.outboxJob.findMany({where:{contractId:contract.id},orderBy:{reminderDays:'desc'}})).map(job=>[job.reminderDays,job.state]),
    [[30,'SUCCEEDED'],[20,'PENDING'],[10,'PENDING']])
  assert.equal(await db.outboxJob.count({where:{contractId:cancelled.id}}),0)
  settings = await data(await managed([30,20,10],settings.version,false))
  assert.equal(await db.outboxJob.count({where:{contractId:contract.id,state:'PENDING'}}),0)
  settings = await data(await managed([30,20,10]))
  assert.equal(await db.outboxJob.count({where:{contractId:contract.id,state:'PENDING'}}),2)
  assert.equal(await db.outboxJob.count({where:{contractId:contract.id,state:'SUCCEEDED'}}),1)
})

test('invitation is single-use setup, permission changes and explicit revocation invalidate sessions', async () => {
  const email = 'invitation-'+mark+'@example.invalid'
  const draft = {email,displayName:'Compte de vérification',role:'ADVISOR'}
  assert.equal((await call('/admin/staff','POST',draft,advisor)).status,403)
  const account = await data<{id:string;version:number;setupComplete:boolean}>(await call('/admin/staff','POST',draft),201)
  assert.equal(account.setupComplete,false)
  const detail = await data<Record<string,unknown>>(await call('/admin/staff/'+account.id))
  for (const key of ['passwordHash','token','sessionId']) assert.equal(key in detail,false)
  for (let i=0;i<50 && !mail.some(item=>item.to===email);i++) await deliverNextMail(db,config,mailer)
  const link = String(mail.find(item=>item.to===email)?.text).match(/https?:\/\/\S+#token=([\w-]+)/)
  assert.ok(link)
  const secret = link[1]
  const password = randomToken()
  assert.equal((await call('/auth/reset-password','POST',{token:secret,password},{})).status,204)
  assert.equal((await call('/auth/reset-password','POST',{token:secret,password},{})).status,422)
  let staff = await login(email,password)
  const row = await db.staffUser.findUniqueOrThrow({where:{id:account.id}})
  assert.equal((await call('/admin/staff/'+account.id,'PATCH',{version:row.version,role:'ADMIN'})).status,200)
  assert.equal((await call('/auth/session','GET',undefined,staff)).status,401)
  staff = await login(email,password)
  const promoted = await db.staffUser.findUniqueOrThrow({where:{id:account.id}})
  const afterRevoke = await data<{version:number}>(await call('/admin/staff/'+account.id+'/revoke-sessions','POST',{version:promoted.version}))
  assert.equal((await call('/auth/session','GET',undefined,staff)).status,401)
  staff = await login(email,password)
  assert.equal((await call('/admin/staff/'+account.id,'PATCH',{version:afterRevoke.version,isActive:false})).status,200)
  assert.equal((await call('/auth/session','GET',undefined,staff)).status,401)
})

test('settings and approved wording are frozen before rendering and previously issued PDF bytes stay identical', async () => {
  const original = await publish('QUOTE','Texte approuvé initial pour la proposition synthétique.')
  const draft = await data<{id:string;version:number}>(await call('/admin/quotes','POST',{
    clientId,partnerId,productSlug:'habitation',annualPremiumMad:'150.00',validUntil:addDays(date,28),
    coverage:'Garanties synthétiques',coverageLimits:'Limites synthétiques',conditions:'Conditions synthétiques',
  }),201)
  const issue = await data<{documents:{id:string}[]}>(await call('/admin/quotes/'+draft.id+'/issue','POST',{version:draft.version}),202)
  const docId = issue.documents[0].id
  const path = '/admin/documents/'+docId+'/download'
  for(let i=0;i<40 && (await db.document.findUniqueOrThrow({where:{id:docId}})).status==='QUEUED';i++) await generateNextQuotePdf(db,config)
  const download = async () => {
    const response = await call(path)
    assert.equal(response.status,200)
    return Buffer.from(await response.arrayBuffer())
  }
  const bytes = await download()
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-')
  const before = await db.document.findUniqueOrThrow({where:{id:docId}})
  await publish('QUOTE','Nouvelle version du texte pour les futures propositions.')
  settings = await data(await call('/admin/settings','PATCH',{version:settings.version,approved:true,agencyName:'Zahraoui Cover – Vérification'}))
  const quote = await db.quote.findUniqueOrThrow({where:{id:draft.id}})
  assert.deepEqual((quote.issuedSnapshot as {quoteWording:object}).quoteWording,{id:original.id,body:original.body})
  assert.deepEqual(await download(),bytes)
  assert.deepEqual(await db.document.findUniqueOrThrow({where:{id:docId}}),before)
})

test('last administrator remains active and readiness does not override production gates', async () => {
  await db.staffUser.updateMany({where:{id:{not:primaryAdminId},role:'ADMIN'},data:{isActive:false}})
  const owner = await db.staffUser.findUniqueOrThrow({where:{id:primaryAdminId}})
  for (const change of [{ isActive:false },{ role:'ADVISOR' }]) {
    const response = await call('/admin/staff/'+owner.id,'PATCH',{version:owner.version,...change})
    assert.equal(response.status,409)
    assert.match(await response.text(),/LAST_ADMIN/)
  }
  const production = (await createApp(db,{...config,NODE_ENV:'production'})).listen(0,'127.0.0.1')
  await once(production,'listening')
  const originalOrigin = origin
  origin = 'http://127.0.0.1:' + (production.address() as AddressInfo).port
  try {
    const ready = await data<{id:string;state:string}[]>(await call('/admin/settings/readiness'))
    assert.equal(ready.find(item=>item.id==='quote')?.state,'VERIFIED')
    assert.equal(ready.find(item=>item.id==='malware')?.state,'PENDING')
    assert.equal((await call('/admin/staff','POST',{displayName:'Compte de test',email:'no-send@example.invalid',role:'ADVISOR'})).status,503)
    assert.equal((await call('/admin/quotes/'+randomUUID()+'/issue','POST',{version:1})).status,503)
    assert.equal((await call('/admin/documents','POST',{})).status,503)
    assert.equal((await call('/admin/imports','POST',{})).status,503)
  } finally {
    origin = originalOrigin
    await new Promise<void>((resolve,reject)=>production.close(error=>error?reject(error):resolve()))
  }
  assert.ok(await db.auditEvent.count({where:{action:'AGENCY_CONTENT_PUBLISHED'}})>=4)
  assert.ok(await db.auditEvent.count({where:{action:'STAFF_SESSIONS_REVOKED'}})>=1)
})
