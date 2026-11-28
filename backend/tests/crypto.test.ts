import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import { loadConfig } from '../src/config/env.js'
import { localMail } from '../src/modules/agency/model.js'
import { csrfFor, digestToken, hashPassword, openResetToken, passwordMatches, randomToken, sealResetToken, tokenFormat, validCsrf } from '../src/utils/crypto.js'

test('passwords have distinct Argon2id hashes with the configured work factor', async () => {
  const password = randomToken()
  const left = await hashPassword(password)
  const right = await hashPassword(password)
  assert.match(left, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
  assert.notEqual(left, right)
  assert.equal(await passwordMatches(left, password), true)
  assert.equal(await passwordMatches(left, randomToken()), false)
})

test('session CSRF proof depends on its token and key', () => {
  const token = randomToken()
  const key = randomBytes(32)
  const csrf = csrfFor(key, token)
  assert.ok(tokenFormat.test(token))
  assert.equal(digestToken(token).length, 32)
  assert.equal(validCsrf(csrf, csrfFor(key, token)), true)
  assert.equal(validCsrf(csrf, csrfFor(key, randomToken())), false)
  assert.equal(validCsrf(csrf, 'bad'), false)
})

test('reset encryption binds the token to the job and detects tampering', () => {
  const token = randomToken()
  const key = randomBytes(32)
  const id = randomUUID()
  const sealed = sealResetToken(key, id, token)
  assert.ok(!sealed.includes(Buffer.from(token)))
  assert.equal(openResetToken(key, id, sealed), token)
  assert.throws(() => openResetToken(key, randomUUID(), sealed))
  sealed[28] ^= 1
  assert.throws(() => openResetToken(key, id, sealed))
})

test('production requires HTTPS, rejects local SMTP and enforces independent key material', () => {
  const env = {
    NODE_ENV: 'production',
    PUBLIC_ORIGIN: 'https://example.invalid',
    DATABASE_URL: 'postgresql://localhost/zahraoui_cover_test',
    RATE_KEY_SECRET: randomBytes(32).toString('hex'),
    CSRF_SECRET: randomBytes(32).toString('hex'),
    RESET_JOB_KEY: randomBytes(32).toString('hex'),
  }
  assert.equal(loadConfig(env).NODE_ENV, 'production')
  assert.throws(() => loadConfig({ ...env, PUBLIC_ORIGIN: 'http://example.invalid' }), /HTTPS/)
  assert.throws(() => loadConfig({ ...env, SMTP_MODE: 'local', SMTP_HOST: '127.0.0.1' }), /loopback outside production/)
  assert.throws(() => loadConfig({ ...env, CSRF_SECRET: env.RATE_KEY_SECRET }), /different/)
})

test('staging mail is restricted to the isolated Mailpit sink', () => {
  const env = {
    NODE_ENV: 'test', STAGING_MODE: 'true', PUBLIC_ORIGIN: 'http://127.0.0.1:8088',
    DATABASE_URL: 'postgresql://postgres/zc_stage',
    RATE_KEY_SECRET: randomBytes(32).toString('hex'),
    CSRF_SECRET: randomBytes(32).toString('hex'),
    RESET_JOB_KEY: randomBytes(32).toString('hex'),
    SMTP_MODE: 'local', SMTP_HOST: 'mailpit', SMTP_PORT: '1025', SMTP_FROM: 'stage@example.invalid',
  }
  assert.equal(localMail(loadConfig(env)), true)
  for (const settings of [
    { SMTP_HOST: 'smtp.example.invalid' }, { SMTP_MODE: 'starttls' }, { SMTP_PORT: '2525' },
    { SMTP_FROM: 'stage@example.org' }, { SMTP_USER: 'user', SMTP_PASSWORD: 'password' },
    { PUBLIC_ORIGIN: 'http://example.invalid' }, { PUBLIC_INDEXING_ENABLED: 'true' },
    { NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://example.invalid' },
  ]) assert.throws(() => loadConfig({ ...env, ...settings }), /Staging requires/)
  assert.throws(() => loadConfig({ ...env, STAGING_MODE: 'false' }), /loopback outside production/)
})
