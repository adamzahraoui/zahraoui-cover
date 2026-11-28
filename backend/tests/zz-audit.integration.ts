import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import type { Config } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { cleanAuthRecords } from '../src/modules/notifications/mail-jobs.js'
import { claimJob, maxAttempts } from '../src/modules/notifications/outbox.js'
import { hashPassword, randomToken } from '../src/utils/crypto.js'

const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error('Test database required.')
const u = new URL(url)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(u.pathname) || url === process.env.PRODUCTION_DATABASE_URL) throw new Error('Use an isolated test database.')
const db = connectPrisma(url)
const directory = await mkdtemp(join(tmpdir(), 'zc-audit-'))
const config = loadConfig({ ...process.env, DATABASE_URL: url, RATE_KEY_SECRET: randomBytes(32).toString('hex'), FRONTEND_DIST_DIR: directory })
const servers: { close: (done: () => void) => void }[] = []
let origin: string

async function listen(configuration = config) {
  const server = (await createApp(db,configuration)).listen(0,'127.0.0.1')
  await once(server,'listening')
  servers.push(server)
  return 'http://127.0.0.1:' + (server.address() as AddressInfo).port
}

before(async () => {
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'index.html'), '<!doctype html><html lang="fr"><head><title>Zahraoui Cover</title><meta name="description" content="Test" /><meta name="robots" content="noindex, nofollow" /></head><body><div id="root"></div></body></html>')
  await writeFile(join(directory, 'assets', 'record.js'), 'export {}')
  origin = await listen()
})

after(async () => {
  await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(resolve))))
  await db.$disconnect()
  await rm(directory,{recursive:true,force:true})
})

test('site defaults to noindex and applies route, header and cache policies', async () => {
  const response = await fetch(origin+'/contact')
  assert.equal(response.status,200)
  assert.match(await response.text(),/<title>Contact \| Zahraoui Cover<\/title>/)
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow')
  assert.match(response.headers.get('content-security-policy') ?? '',/script-src 'self'/)
  assert.match(response.headers.get('content-security-policy') ?? '',/frame-ancestors 'none'/)
  assert.equal(response.headers.get('permissions-policy'),'camera=(), microphone=(), geolocation=(), payment=()')
  assert.equal(response.headers.get('x-content-type-options'),'nosniff')
  assert.equal(response.headers.get('referrer-policy'),'no-referrer')
  assert.equal((await fetch(origin+'/admin/login')).headers.get('cache-control'),'no-store')
  assert.equal((await fetch(origin+'/api/agency')).headers.get('cache-control'),'no-store')
  assert.equal((await fetch(origin+'/page-absente')).status,404)
  assert.equal((await fetch(origin+'/assets/absent.js')).status,404)
  assert.equal((await fetch(origin+'/api/absent')).status,404)
  assert.match((await fetch(origin+'/assets/record.js')).headers.get('cache-control') ?? '',/immutable/)
  assert.match(await (await fetch(origin+'/robots.txt')).text(),/Disallow: \//)
  assert.equal((await fetch(origin+'/sitemap.xml')).status,404)
})

test('crawl opt-in requires approval, excludes admin and unpublished insurance and serves escaped metadata', async () => {
  const production: Config = { ...config, NODE_ENV:'production', SMTP_MODE:'disabled', PUBLIC_ORIGIN:'https://staging.example.invalid', PUBLIC_INDEXING_ENABLED:true }
  const site = await listen(production)
  const email = randomUUID()+'@example.invalid'
  const member = await db.staffUser.create({data:{email,displayName:'B14 audit',role:'ADMIN'}})
  // Quote/priv privacy fixtures can predate this test. A default-disabled configuration still has no sitemap.
  const defaultSite = await listen({...production, PUBLIC_INDEXING_ENABLED:false})
  assert.equal((await fetch(defaultSite+'/sitemap.xml')).status,404)
  for(const kind of ['LEGAL','PRIVACY','COOKIES','QUOTE'] as const) await db.agencyContent.create({data:{
    kind,body:'Publication synthétique de vérification.',publishedAt:new Date(),publisherId:member.id,
  }})
  await db.agencySettings.update({where:{id:1},data:{publicApprovedAt:new Date()}})
  for(const slug of ['automobile','voyage'] as const) {
    const values = {title:'Assurance & famille',summary:'Assurance pour "famille" et particuliers.',audiences:['INDIVIDUAL' as const],
      eligibilityText:'Vérification.',potentialCoverages:[],documentHints:[],faqs:[],relatedSlugs:[],
      isPublished:slug==='automobile',isActive:true}
    await db.insuranceProduct.upsert({where:{slug},update:values,create:{...values,slug}})
  }
  const map = await fetch(site+'/sitemap.xml')
  assert.equal(map.status,200)
  const xml=await map.text()
  assert.match(xml,/https:\/\/staging.example.invalid\/assurances\/automobile/)
  assert.doesNotMatch(xml,/\/admin|assurances\/voyage/)
  const product = await fetch(site+'/assurances/automobile?campagne=test')
  const html = await product.text()
  assert.match(html,/Assurance &amp; famille/)
  assert.match(html,/&quot;famille&quot;/)
  assert.match(html,/rel="canonical" href="https:\/\/staging.example.invalid\/assurances\/automobile"/)
  assert.match(html,/og:title/)
  assert.equal((await fetch(site+'/assurances/voyage')).status,404)
  assert.equal((await fetch(site+'/admin/login')).headers.get('x-robots-tag'),'noindex, nofollow')
})

test('direct API access, protected mutations and revoked sessions are independently enforced', async () => {
  const id = randomUUID()
  const detailPaths = ['clients','quote-requests','quotes','contracts','assistance','messages','partners','documents','staff','imports']
  const writePaths = ['/admin/settings','/admin/staff/'+id,'/admin/partners/'+id,'/admin/catalog/'+id,'/admin/contracts/'+id]
  for(const path of detailPaths) assert.equal((await fetch(origin+'/api/admin/'+path+'/'+id)).status,401)
  const email = randomUUID()+'@example.invalid'
  const password = randomToken()
  const staff = await db.staffUser.create({data:{email,displayName:'B14 advisor',role:'ADVISOR',passwordHash:await hashPassword(password)}})
  const login = await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:config.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({email,password})})
  assert.equal(login.status,200)
  const cookie=(login.headers.get('set-cookie') ?? '').split(';')[0]
  const {csrfToken}=(await login.json() as {data:{csrfToken:string}}).data
  assert.equal((await fetch(origin+'/api/admin/exports/CLIENTS',{headers:{Cookie:cookie}})).status,403)
  for(const path of writePaths.slice(0,-1)) assert.equal((await fetch(origin+'/api'+path,{method:'PATCH',
    headers:{Cookie:cookie,Origin:config.PUBLIC_ORIGIN,'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:'{}'})).status,403)
  assert.equal((await fetch(origin+'/api'+writePaths.at(-1),{method:'PATCH',headers:{Cookie:cookie,Origin:config.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:'{}'})).status,403)
  await db.staffUser.update({where:{id:staff.id},data:{isActive:false}})
  assert.equal((await fetch(origin+'/api/admin/dashboard',{headers:{Cookie:cookie}})).status,401)
})

test('exhausted mail jobs finish while one expired lease remains reclaimable by only one worker', async () => {
  const caseRef = await db.contactMessage.create({data:{
    reference:'MSG-AUDIT-'+randomUUID().slice(0,10),fullName:'Audit synthétique',phone:'+212611001900',email:'fixture@example.invalid',
    subject:'Audit',message:'Message synthétique',noticeVersion:'fixture',acknowledgedAt:new Date(),
  }})
  const base = {messageId:caseRef.id,kind:'CONTACT_ACK' as const,nextAttemptAt:new Date('2024-01-01T00:00:00Z')}
  const exhausted=await db.outboxJob.create({data:{...base,dedupeKey:randomUUID(),attemptCount:maxAttempts}})
  const recoverable=await db.outboxJob.create({data:{...base,dedupeKey:randomUUID(),attemptCount:2,state:'RUNNING',leaseToken:randomUUID(),leaseUntil:new Date(0)}})
  await cleanAuthRecords(db)
  assert.equal((await db.outboxJob.findUniqueOrThrow({where:{id:exhausted.id}})).state,'FAILED')
  assert.equal((await db.outboxJob.findUniqueOrThrow({where:{id:recoverable.id}})).state,'RUNNING')
  const claimed=await Promise.all([claimJob(db,['CONTACT_ACK']),claimJob(db,['CONTACT_ACK'])])
  assert.equal(claimed.filter(job=>job?.id===recoverable.id).length,1)
  const updated=await db.outboxJob.findUniqueOrThrow({where:{id:recoverable.id}})
  assert.equal(updated.attemptCount,3)
  assert.ok(updated.leaseUntil && updated.leaseUntil>new Date())
})
