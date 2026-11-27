import { createHash, createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { argon2id, hash, verify } from 'argon2'

export const tokenFormat = /^[A-Za-z0-9_-]{43}$/
export const randomToken = () => randomBytes(32).toString('base64url')
export const digestToken = (value: string) => createHash('sha256').update(value).digest()
export const keyedDigest = (key: Buffer, value: string) => createHmac('sha256', key).update(value).digest()

export function hashPassword(password: string) {
  return hash(password, { type: argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 })
}

export async function passwordMatches(passwordHash: string, password: string) {
  return verify(passwordHash, password).catch(() => false)
}

export function csrfFor(secret: Buffer, sessionToken: string) {
  return keyedDigest(secret, sessionToken).toString('base64url')
}

export function validCsrf(expected: string, supplied: string | undefined) {
  return Boolean(supplied && tokenFormat.test(supplied) && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)))
}

// AES-GCM authenticates the reset job ID alongside the encrypted token.
export function sealResetToken(key: Buffer, resetId: string, token: string) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(Buffer.from(resetId))
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([nonce, cipher.getAuthTag(), body])
}

export function openResetToken(key: Buffer, resetId: string, encrypted: Uint8Array) {
  const data = Buffer.from(encrypted)
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
  decipher.setAAD(Buffer.from(resetId))
  decipher.setAuthTag(data.subarray(12, 28))
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8')
}
