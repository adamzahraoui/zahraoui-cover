import { z } from 'zod'

const secret = z.string().regex(/^[a-fA-F0-9]{64}$/).transform(value => Buffer.from(value, 'hex'))
const optional = (value: unknown) => value === '' ? undefined : value

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_ORIGIN: z.string().url().refine(value => {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value
  }),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(4).default(0),
  DATABASE_URL: z.string().url().refine(value => ['postgresql:', 'postgres:'].includes(new URL(value).protocol)),
  RATE_KEY_SECRET: secret,
  CSRF_SECRET: secret,
  RESET_JOB_KEY: secret,
  SMTP_MODE: z.enum(['disabled', 'local', 'tls', 'starttls']).default('disabled'),
  SMTP_HOST: z.preprocess(optional, z.string().min(1).optional()),
  SMTP_PORT: z.preprocess(optional, z.coerce.number().int().min(1).max(65535).optional()),
  SMTP_FROM: z.preprocess(optional, z.string().email().optional()),
  SMTP_USER: z.preprocess(optional, z.string().min(1).optional()),
  SMTP_PASSWORD: z.preprocess(optional, z.string().min(1).optional()),
})

export type Config = z.infer<typeof schema>

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(environment)
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map(issue => issue.path.join('.')))]
    throw new Error(`Invalid environment settings: ${keys.join(', ')}`)
  }
  const config = result.data
  if (new Set([config.RATE_KEY_SECRET.toString('hex'), config.CSRF_SECRET.toString('hex'), config.RESET_JOB_KEY.toString('hex')]).size !== 3) {
    throw new Error('RATE_KEY_SECRET, CSRF_SECRET and RESET_JOB_KEY must be different')
  }
  if (config.NODE_ENV === 'production' && !config.PUBLIC_ORIGIN.startsWith('https://')) {
    throw new Error('PUBLIC_ORIGIN requires HTTPS in production')
  }
  if (config.SMTP_MODE === 'local' && (
    config.NODE_ENV === 'production' || !['127.0.0.1', '::1', 'localhost'].includes(config.SMTP_HOST ?? '')
  )) {
    throw new Error('Local SMTP is available only on loopback outside production')
  }
  if (config.SMTP_MODE !== 'disabled' && !(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_FROM)) {
    throw new Error('SMTP_HOST, SMTP_PORT and SMTP_FROM are required when SMTP is enabled')
  }
  if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together')
  }
  return config
}
