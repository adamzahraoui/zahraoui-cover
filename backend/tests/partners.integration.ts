import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { casablancaDate } from '../src/modules/business-inputs.js'
import { addDays } from '../src/modules/contracts/model.js'
import type { Mailer } from '../src/modules/notifications/mail-jobs.js'
import { deliverNextQuote, generateNextQuotePdf } from '../src/modules/quotes/jobs.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must use a dedicated local _test database.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) throw new Error('Test database required.')
const folder = await mkdtemp(join(tmpdir(), 'zc-partner-test-'))
const config = loadConfig({
  ...process.env, DATABASE_URL: testUrl, QUOTE_PDF_DIR: folder, RATE_KEY_SECRET: randomBytes(32).toString('hex'),
  SMTP_MODE: 'local', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_FROM: 'broker@example.invalid',
})
const db = connectPrisma(testUrl)
const marker = randomUUID().slice(0, 8)
const originalName = 'Compagnie synthétique ' + marker
const alias = 'Libellé public ' + marker
const fields = {
  name: originalName, displayName: alias, categories: ['sante'], website: 'https://example.invalid/',
  contactPerson: 'Contact synthétique', phone: '06 00 00 42 85', email: marker + '@example.invalid',
  address: 'Adresse synthétique', internalNotes: 'Donnée de test interne',
}
const today = casablancaDate()
let origin: string
let close: () => Promise<void>
let admin: Record<string, string>
let advisor: Record<string, string>
let partner: PartnerResult
let customerId: string
let quote: QuoteResult
let policy: PolicyResult
let quotePdf: Buffer
let proofHref: string
let quoteHref: string
type PartnerResult = {
  id: string; version: number; name: string; displayName: string; phone: string;
  verifiedAt: string | null; verificationReference: string | null; isActive: boolean; isPublished: boolean;
  categories: string[]; recentQuotes: { id: string }[]; recentContracts: { id: string }[];
  activity: { action: string }[]
}
type QuoteResult = { id: string; version: number; status: string; partnerName: string; documents: { id: string }[] }
type PolicyResult = { id: string; version: number; partnerName: string; documents: { id: string }[] }
function call(path: string, method = 'GET', body?: object, headers: Record<string, string> = {}) {
  return fetch(origin + '/api' + path, {
    method, headers: { Origin: config.PUBLIC_ORIGIN, ...(body && { 'Content-Type': 'application/json' }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}
async function data<T = PartnerResult>(result: Response, status = 200) {
  assert.equal(result.status, status)
  return (await result.json() as { data: T }).data
}
async function signIn(role: 'ADMIN' | 'ADVISOR') {
  const email = randomUUID()+'@example.invalid'
  const password = randomToken()
  await db.staffUser.create({ data: { role, displayName: 'Test partenaires', email, passwordHash: await hashPassword(password) } })
  const response = await call('/auth/login','POST',{ email, password })
  const { csrfToken } = await data<{ csrfToken: string }>(response)
  return { Cookie: (response.headers.get('set-cookie') ?? '').split(';')[0], 'X-CSRF-Token': csrfToken }
}
function partnerUpdate(fields: object, headers = admin) {
  return call('/admin/partners/' + partner.id, 'PATCH', { version: partner.version, ...fields }, headers)
}
function verify(row: PartnerResult, headers = admin) {
  return call('/admin/partners/' + row.id + '/verify', 'POST', { version: row.version, reference: 'Référence synthétique B10' }, headers)
}
const quoteFields = {
  productSlug: 'sante', annualPremiumMad: '1000.25', validUntil: addDays(today, 20),
  coverage: 'Couverture de vérification sans garanties réelles.', coverageLimits: 'Limites de test.', conditions: 'Conditions synthétiques.',
}
function createQuote(more = {}) {
  return call('/admin/quotes','POST',{ ...quoteFields, clientId: customerId, partnerId: partner.id, ...more },advisor)
}
function createPolicy(more = {}) {
  return call('/admin/contracts/external','POST',{ productSlug:'sante', clientId:customerId, partnerId:partner.id,
    effectiveOn:today, expiresOn:addDays(today,90), policyNumber:'POL-'+marker, premiumMad:'1010.55', coverage:'Garanties de test uniquement.', ...more },advisor)
}
function changeQuote(action: string, body = {}) {
  return call('/admin/quotes/'+quote.id+'/'+action,'POST',{ version:quote.version, ...body },admin)
}
async function options(productSlug: string) {
  return data<{id:string;name:string}[]>(await call('/admin/quotes/partner-options?productSlug='+productSlug,'GET',undefined,advisor))
}

before(async () => {
  await db.$connect()
  const server = (await createApp(db,config)).listen(0,'127.0.0.1')
  await once(server,'listening')
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
  close = () => new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()))
  admin = await signIn('ADMIN')
  advisor = await signIn('ADVISOR')
  for (const slug of ['sante', 'automobile'] as const) {
    await db.insuranceProduct.upsert({ where:{slug}, update:{}, create:{
      slug, title:'Produit de test '+slug, summary:'Catégorie de test temporaire.', audiences:['INDIVIDUAL'],
      eligibilityText:'', potentialCoverages:[], documentHints:[], faqs:[], relatedSlugs:[],
    } })
  }
  customerId = (await db.client.create({ data:{ displayName:'Client synthétique '+marker, profile:'INDIVIDUAL',
    phone:'+212600000443', email:'customer-'+marker+'@example.invalid' } })).id
})
after(async () => {
  await close?.()
  await db.$disconnect()
  await rm(folder,{recursive:true,force:true})
})

test('partner drafts validate fields, duplicates, roles and category assignments', async () => {
  assert.equal((await call('/admin/partners')).status,401)
  assert.equal((await call('/admin/partners','POST',fields,advisor)).status,403)
  assert.equal((await call('/admin/partners','POST',fields,{Cookie:admin.Cookie})).status,403)
  for (const changes of [{ name:' ' },{ email:'bad' },{ phone:'123' },{ website:'http://example.invalid' },
    { website:'https://account:secret@example.invalid/' },{ website:'javascript:alert(1)' },{ categories:['sante','sante'] },
    { logoKey:'danger.svg' }]) assert.equal((await call('/admin/partners','POST',{ ...fields, ...changes },admin)).status,422)
  assert.equal((await call('/admin/partners','POST',{ ...fields,isActive:true },admin)).status,409)
  partner = await data(await call('/admin/partners','POST',fields,admin),201)
  assert.equal(partner.phone,'+212600004285')
  assert.equal(partner.verifiedAt,null)
  assert.equal(partner.isActive,false)
  assert.equal((await call('/admin/partners','POST',{ ...fields,name:' '+fields.name.toUpperCase()+' ' },admin)).status,409)
  assert.equal((await verify(partner,advisor)).status,403)
  assert.equal((await partnerUpdate({ isPublished:true },advisor)).status,403)
  assert.equal((await partnerUpdate({ isActive:true })).status,409)
  assert.equal((await createQuote()).status,409)
  assert.equal((await createPolicy()).status,409)
})

test('staff search and page partner records while drafts require a category before verification', async () => {
  const second = await data(await call('/admin/partners','POST',{ name:originalName+' Deux' },admin),201)
  assert.equal((await verify(second)).status,409)
  const ids=[]
  for (const page of [1,2]) {
    const result=await call('/admin/partners?'+new URLSearchParams({ status:'UNVERIFIED',q:originalName,limit:'1',page:String(page) }),'GET',undefined,advisor)
    assert.equal(result.status,200)
    const body=await result.json() as { data: PartnerResult[]; meta:{total:number;page:number} }
    assert.equal(body.meta.total,2)
    assert.equal(body.meta.page,page)
    ids.push(body.data[0].id)
  }
  assert.deepEqual(ids,[partner.id,second.id])
  const filtered = await data<PartnerResult[]>(await call('/admin/partners?'+new URLSearchParams({ productSlug:'sante', q:alias }),'GET',undefined,advisor))
  assert.deepEqual(filtered.map(row=>row.id),[partner.id])
  assert.equal((await call('/admin/partners/'+partner.id)).status,401)
  assert.equal((await data(await call('/admin/partners/'+partner.id,'GET',undefined,advisor))).name,originalName)
})

test('verification, activation and publication each require a separate authorized state', async () => {
  partner=await data(await verify(partner))
  assert.ok(partner.verifiedAt)
  assert.equal(partner.isActive,false)
  assert.equal((await partnerUpdate({isPublished:true})).status,409)
  assert.equal((await verify({...partner,version:1})).status,409)
  partner=await data(await partnerUpdate({isActive:true}))
  assert.equal(partner.isPublished,false)
  assert.equal((await options('sante')).find(row=>row.id===partner.id)?.name,alias)
  assert.ok(!(await options('automobile')).some(row=>row.id===partner.id))
  assert.notEqual((await createQuote({productSlug:'automobile'})).status,201)
  assert.equal((await createPolicy({productSlug:'automobile'})).status,409)
  assert.ok(!(await data<{name:string}[]>(await call('/partners'))).some(row=>row.name===alias))
  partner=await data(await partnerUpdate({isPublished:true}))
  const published=await data<{name:string;website:string}[]>(await call('/partners'))
  assert.deepEqual(published.find(row=>row.name===alias),{ name:alias,website:fields.website })
  partner=await data(await partnerUpdate({internalNotes:'Changement interne'}))
  assert.equal(partner.isPublished,true)
  assert.ok(partner.activity.some(event=>event.action==='PARTNER_VERIFIED'))
})

test('changing the verified scope withdraws the listing and preserves historical quote and contract bytes', async () => {
  quote=await data<QuoteResult>(await createQuote(),201)
  quote=await data<QuoteResult>(await changeQuote('issue'),202)
  assert.equal(await generateNextQuotePdf(db,config),true)
  quoteHref='/admin/documents/'+quote.documents[0].id+'/download'
  quotePdf=Buffer.from(await (await call(quoteHref,'GET',undefined,advisor)).arrayBuffer())
  assert.equal(quotePdf.subarray(0,5).toString(),'%PDF-')
  policy=await data<PolicyResult>(await createPolicy(),201)
  policy=await data<PolicyResult>(await call('/admin/contracts/'+policy.id+'/status','POST',{
    version:policy.version,status:'ACTIVE',confirmationOn:today,confirmationReference:'Test de confirmation',
  },admin),202)
  const attachment=await fetch(origin+'/api/admin/contracts/'+policy.id+'/documents?version='+policy.version,{
    method:'POST',headers:{...admin,Origin:config.PUBLIC_ORIGIN,'Content-Type':'application/pdf'},body:new Uint8Array(quotePdf),
  })
  policy=await data<PolicyResult>(attachment,201)
  proofHref='/admin/documents/'+policy.documents[0].id+'/download'
  const before=await db.quote.findUniqueOrThrow({where:{id:quote.id}})
  const stored=await db.contract.findUniqueOrThrow({where:{id:policy.id}})
  partner=await data(await partnerUpdate({isActive:false}))
  assert.equal(partner.isPublished,false)
  assert.ok(partner.verifiedAt)
  assert.equal((await changeQuote('send')).status,409)
  assert.equal((await createQuote()).status,409)
  assert.equal((await createPolicy()).status,409)
  partner=await data(await partnerUpdate({name:originalName+' renommée'}))
  assert.equal(partner.verifiedAt,null)
  assert.equal(partner.verificationReference,null)
  assert.equal((await partnerUpdate({isActive:true})).status,409)
  assert.ok(partner.recentQuotes.some(row=>row.id===quote.id))
  assert.ok(partner.recentContracts.some(row=>row.id===policy.id))
  assert.deepEqual(await db.quote.findUniqueOrThrow({where:{id:quote.id}}),before)
  assert.deepEqual(await db.contract.findUniqueOrThrow({where:{id:policy.id}}),stored)
  assert.equal((await data<QuoteResult>(await call('/admin/quotes/'+quote.id,'GET',undefined,advisor))).partnerName,originalName)
  assert.equal((await data<PolicyResult>(await call('/admin/contracts/'+policy.id,'GET',undefined,advisor))).partnerName,originalName)
  for (const href of [quoteHref,proofHref]) {
    assert.equal((await call(href)).status,401)
    assert.deepEqual(Buffer.from(await (await call(href,'GET',undefined,advisor)).arrayBuffer()),quotePdf)
  }
  assert.equal((await call('/admin/partners/'+partner.id,'DELETE',undefined,admin)).status,404)
  assert.ok(partner.activity.some(event=>event.action==='PARTNER_REVIEW_REQUIRED'))
})

test('a pending quote is not sent after its partner becomes ineligible', async () => {
  partner=await data(await verify(partner))
  partner=await data(await partnerUpdate({isActive:true}))
  quote=await data<QuoteResult>(await createQuote(),201)
  quote=await data<QuoteResult>(await changeQuote('issue'),202)
  assert.equal(await generateNextQuotePdf(db,config),true)
  quote=await data<QuoteResult>(await changeQuote('send'),202)
  partner=await data(await partnerUpdate({isActive:false}))
  const unused={ sendMail:async()=>assert.fail('The transport must not be called') } as unknown as Mailer
  assert.equal(await deliverNextQuote(db,config,unused),true)
  const job=await db.outboxJob.findFirstOrThrow({where:{kind:'QUOTE_DELIVERY',documentId:quote.documents[0].id}})
  assert.equal(job.state,'FAILED')
  assert.equal(job.lastErrorCode,'QUOTE_PARTNER_UNAVAILABLE')
  assert.equal((await db.quote.findUniqueOrThrow({where:{id:quote.id}})).status,'ISSUED')
})
