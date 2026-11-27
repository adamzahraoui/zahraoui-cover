import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app.js'
import type { Config } from '../src/config/env.js'
import { loadConfig } from '../src/config/env.js'
import { connectPrisma } from '../src/database/prisma.js'
import { digestToken, hashPassword, openResetToken, randomToken } from '../src/utils/crypto.js'

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error('TEST_DATABASE_URL must point to a dedicated loopback database ending in _test.')
const url = new URL(testUrl)
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/[a-z0-9_]+_test$/.test(url.pathname) || testUrl === process.env.PRODUCTION_DATABASE_URL) {
  throw new Error('Run this suite only on a dedicated local _test database with NODE_ENV=test.')
}

const config = loadConfig({
  ...process.env,
  DATABASE_URL: testUrl,
  RATE_KEY_SECRET: randomBytes(32).toString('hex'),
})
const database = connectPrisma(config.DATABASE_URL)
let app: Awaited<ReturnType<typeof listen>>

async function listen(client: PrismaClient, settings: Config) {
  const server = (await createApp(client, settings)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    get: (path: string, cookie?: string) => fetch(origin + path, { headers: cookie ? { Cookie: cookie } : {} }),
    post: (path: string, body?: unknown, headers: Record<string, string> = {}) => fetch(origin + path, {
      method: 'POST',
      headers: { Origin: settings.PUBLIC_ORIGIN, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  }
}

async function account(role: 'ADMIN' | 'ADVISOR' = 'ADMIN') {
  const password = randomToken()
  const staff = await database.staffUser.create({ data: {
    email: `test-${randomUUID()}@example.invalid`,
    displayName: 'Compte de test isolé',
    passwordHash: await hashPassword(password),
    role,
  } })
  return { staff, password }
}

type AuthData = { id: string; csrfToken: string; role: string; expiresAt: string }
async function login(email: string, password: string, otherHeaders?: Record<string, string>) {
  const result = await app.post('/api/auth/login', { email, password }, otherHeaders)
  assert.equal(result.status, 200)
  const header = result.headers.get('set-cookie') ?? ''
  const cookie = header.split(';')[0]
  const payload = await result.json() as { data: AuthData }
  return { header, cookie, auth: payload.data }
}

async function code(result: Response, status: number, expected: string) {
  assert.equal(result.status, status)
  const body = await result.json() as { error: { code: string; message: string; requestId: string } }
  assert.equal(body.error.code, expected)
  assert.equal(body.error.requestId, result.headers.get('x-request-id'))
  return body.error.message
}

async function latestReset(staffId: string) {
  const row = await database.passwordResetToken.findFirstOrThrow({ where: { staffId }, orderBy: { createdAt: 'desc' } })
  const outbox = await database.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `reset:${row.id}` } })
  assert.ok(outbox.encryptedSecret)
  const secret = openResetToken(config.RESET_JOB_KEY, row.id, outbox.encryptedSecret)
  assert.deepEqual(Buffer.from(row.tokenHash), digestToken(secret))
  return { id: row.id, secret }
}

before(async () => {
  await database.$connect()
  app = await listen(database, config)
})

after(async () => {
  await app?.close()
  await database.$disconnect()
})

test('liveness, migrated readiness and private route rejection', async () => {
  assert.deepEqual(await (await app.get('/api/health')).json(), { status: 'ok' })
  assert.deepEqual(await (await app.get('/api/health/live')).json(), { status: 'ok' })
  assert.deepEqual(await (await app.get('/api/health/ready')).json(), { status: 'ready' })
  await code(await app.get('/api/auth/session'), 401, 'UNAUTHENTICATED')
  await code(await app.get('/api/admin/access'), 401, 'UNAUTHENTICATED')
})

test('strict JSON validation, request size limits and CORS/Origin checks', async () => {
  await code(await app.post('/api/auth/login', { email: 'bad', extra: 'ignored' }), 422, 'VALIDATION_FAILED')
  await code(await app.post('/api/auth/login', undefined, { 'Content-Type': 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE')
  await code(await app.post('/api/auth/login', { password: 'x'.repeat(36_000) }), 413, 'PAYLOAD_TOO_LARGE')
  const crossOrigin = await app.post('/api/auth/login', {}, { Origin: 'https://other.example.invalid' })
  assert.equal(crossOrigin.headers.get('access-control-allow-origin'), null)
  await code(crossOrigin, 403, 'CSRF_FAILED')
})

test('generic login failure, cookie rotation, server-side storage, RBAC, CSRF and logout', async () => {
  const { staff, password } = await account()
  const known = await code(await app.post('/api/auth/login', { email: staff.email, password: randomToken() }), 401, 'INVALID_CREDENTIALS')
  const unknown = await code(await app.post('/api/auth/login', { email: 'unknown@example.invalid', password }), 401, 'INVALID_CREDENTIALS')
  assert.equal(known, unknown)

  const first = await login(staff.email.toUpperCase(), password)
  assert.match(first.header, /; HttpOnly;/i)
  assert.match(first.header, /; SameSite=Lax/i)
  assert.match(first.header, /; Path=\//i)
  assert.doesNotMatch(first.header, /; Domain=/i)
  assert.deepEqual(Object.keys(first.auth).sort(), ['csrfToken','displayName','email','expiresAt','id','role'])
  assert.equal(first.auth.id, staff.id)
  const raw = first.cookie.slice(first.cookie.indexOf('=') + 1)
  const record = await database.adminSession.findUniqueOrThrow({ where: { tokenHash: digestToken(raw) } })
  assert.equal(record.staffId, staff.id)

  const second = await login(staff.email, password, { Cookie: first.cookie })
  assert.notEqual(first.cookie, second.cookie)
  await code(await app.get('/api/auth/session', first.cookie), 401, 'UNAUTHENTICATED')
  assert.equal((await app.get('/api/auth/session', second.cookie)).headers.get('cache-control'), 'no-store')
  assert.equal((await app.get('/api/admin/access', second.cookie)).status, 200)
  const advisor = await account('ADVISOR')
  const advisorLogin = await login(advisor.staff.email, advisor.password)
  assert.equal((await app.get('/api/auth/session', advisorLogin.cookie)).status, 200)
  await code(await app.get('/api/admin/access', advisorLogin.cookie), 403, 'FORBIDDEN')
  await code(await app.post('/api/auth/logout', undefined, { Cookie: second.cookie }), 403, 'CSRF_FAILED')
  await code(await app.post('/api/auth/logout', undefined, { Cookie: second.cookie, 'X-CSRF-Token': advisorLogin.auth.csrfToken }), 403, 'CSRF_FAILED')
  const logout = await app.post('/api/auth/logout', undefined, { Cookie: second.cookie, 'X-CSRF-Token': second.auth.csrfToken })
  assert.equal(logout.status, 204)
  assert.match(logout.headers.get('set-cookie') ?? '', /^zc_session=;/)
  await code(await app.get('/api/auth/session', second.cookie), 401, 'UNAUTHENTICATED')
})

test('idle expiry, absolute expiry and role or active-state changes revoke sessions', async () => {
  const { staff, password } = await account()
  for (const kind of ['idle', 'absolute', 'role', 'disable'] as const) {
    const active = await login(staff.email, password)
    if (kind === 'idle') {
      await database.adminSession.updateMany({ where: { staffId: staff.id, revokedAt: null }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } })
    } else if (kind === 'absolute') {
      const earlier = new Date(Date.now() - 60_000)
      await database.adminSession.updateMany({ where: { staffId: staff.id, revokedAt: null }, data: {
        createdAt: new Date(Date.now() - 120_000), expiresAt: earlier, lastSeenAt: earlier,
      } })
    } else {
      await database.staffUser.update({ where: { id: staff.id }, data: kind === 'role' ? { role: 'ADVISOR' } : { isActive: false } })
    }
    await code(await app.get('/api/auth/session', active.cookie), 401, 'UNAUTHENTICATED')
  }
})

test('reset generic response, expiry, one-time consumption and revocation across sessions', async () => {
  assert.notEqual(config.SMTP_MODE, 'disabled', 'Use local SMTP configuration for recovery tests')
  const { staff, password } = await account()
  const prior = await login(staff.email, password)
  const unknown = await app.post('/api/auth/forgot-password', { email: `unknown-${randomUUID()}@example.invalid` })
  const known = await app.post('/api/auth/forgot-password', { email: staff.email })
  assert.equal(unknown.status, 202)
  assert.equal(known.status, 202)
  assert.deepEqual(await known.json(), await unknown.json())

  const expired = await latestReset(staff.id)
  await database.passwordResetToken.update({ where: { id: expired.id }, data: {
    createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000),
  } })
  await code(await app.post('/api/auth/reset-password', { token: expired.secret, password: randomToken() }), 422, 'RESET_INVALID')
  assert.equal((await app.post('/api/auth/forgot-password', { email: staff.email })).status, 202)
  const active = await latestReset(staff.id)
  const newPassword = randomToken()
  const results = await Promise.all(Array.from({ length: 2 }, () =>
    app.post('/api/auth/reset-password', { token: active.secret, password: newPassword })))
  assert.deepEqual(results.map(r => r.status).sort(), [204, 422])
  await code(await app.post('/api/auth/reset-password', { token: active.secret, password: newPassword }), 422, 'RESET_INVALID')
  await code(await app.get('/api/auth/session', prior.cookie), 401, 'UNAUTHENTICATED')
  assert.equal((await login(staff.email, newPassword)).auth.id, staff.id)
  const job = await database.outboxJob.findUniqueOrThrow({ where: { dedupeKey: `reset:${active.id}` } })
  assert.equal(job.encryptedSecret, null)
})

test('password change checks the current password and invalidates all existing sessions', async () => {
  const { staff, password } = await account()
  const first = await login(staff.email, password)
  const second = await login(staff.email, password)
  const headers = { Cookie: first.cookie, 'X-CSRF-Token': first.auth.csrfToken }
  const newPassword = randomToken()
  await code(await app.post('/api/auth/change-password', { currentPassword: randomToken(), newPassword }, headers), 422, 'CURRENT_PASSWORD_INVALID')
  assert.equal((await app.post('/api/auth/change-password', { currentPassword: password, newPassword }, headers)).status, 204)
  await code(await app.get('/api/auth/session', second.cookie), 401, 'UNAUTHENTICATED')
  assert.equal((await login(staff.email, newPassword)).auth.id, staff.id)
})

test('persistent login rate limit atomically caps concurrent failed verification attempts', async () => {
  const isolated = await listen(database, { ...config, RATE_KEY_SECRET: randomBytes(32) })
  try {
    const { staff } = await account()
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      isolated.post('/api/auth/login', { email: staff.email, password: randomToken() })))
    assert.deepEqual(results.map(result => result.status).sort(), [401,401,401,401,401,429])
    const limited = results.find(result => result.status === 429)
    assert.ok(Number(limited?.headers.get('retry-after')) > 0)
  } finally {
    await isolated.close()
  }
})

test('production HTTPS cookie attributes', async () => {
  const https = await listen(database, { ...config, NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://example.invalid', RATE_KEY_SECRET: randomBytes(32) })
  try {
    const { staff, password } = await account()
    const response = await https.post('/api/auth/login', { email: staff.email, password })
    const cookie = response.headers.get('set-cookie') ?? ''
    assert.equal(response.status, 200)
    assert.match(cookie, /^__Host-zc_session=/)
    assert.match(cookie, /; Secure;/i)
    assert.match(cookie, /; HttpOnly;/i)
    assert.doesNotMatch(cookie, /; Domain=/i)
  } finally {
    await https.close()
  }
})

test('database failure leaves liveness available and returns only generic readiness and login errors', async () => {
  const listener = createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const invalid = new URL(config.DATABASE_URL)
  invalid.port = String((listener.address() as AddressInfo).port)
  invalid.searchParams.set('connect_timeout', '1')
  await new Promise<void>(resolve => listener.close(() => resolve()))
  const unavailable = connectPrisma(invalid.href)
  const service = await listen(unavailable, config)
  try {
    assert.equal((await service.get('/api/health')).status, 200)
    const ready = await service.get('/api/health/ready')
    assert.equal(ready.status, 503)
    assert.deepEqual(await ready.json(), { status: 'unavailable' })
    await code(await service.post('/api/auth/login', { email: 'case@example.invalid', password: randomToken() }), 503, 'SERVICE_UNAVAILABLE')
  } finally {
    await service.close()
    await unavailable.$disconnect()
  }
})

test('migration enforces auth keys, delete rules and PostgreSQL-only constraints', async () => {
  const { staff } = await account()
  const [schema] = await database.$queryRaw<{ tables: number; checks: number; indexes: number; hasCascade: boolean }[]>`
    SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') AS tables,
      (SELECT count(*)::int FROM pg_constraint WHERE conname IN ('session_token_hash_size','submission_key_target','outbox_job_state','document_parent')) AS checks,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public'
        AND indexname IN ('partners_lower_name_key','documents_quote_revision_key','clients_display_name_prefix_idx')) AS indexes,
      EXISTS (SELECT 1 FROM pg_constraint
        WHERE conname = 'admin_sessions_staff_id_fkey' AND confdeltype = 'c') AS "hasCascade"
  `
  assert.deepEqual(schema, { tables: 18, checks: 4, indexes: 3, hasCascade: true })
  await assert.rejects(database.staffUser.create({ data: { email: staff.email, displayName: 'Duplicata de test', role: 'ADMIN' } }))
  await assert.rejects(database.adminSession.create({ data: {
    staffId: staff.id, tokenHash: Buffer.alloc(31), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
  } }))
  await assert.rejects(database.adminSession.create({ data: {
    staffId: randomUUID(), tokenHash: randomBytes(32), lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
  } }))
})
