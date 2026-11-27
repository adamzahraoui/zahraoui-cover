import type { PrismaClient } from '@prisma/client'
import express from 'express'
import helmet from 'helmet'
import type { Config } from './config/env.js'
import { ApiError, handleError } from './middleware/errors.js'
import { sameOrigin, trackRequest } from './middleware/request.js'
import { authRoutes } from './modules/auth/routes.js'
import { currentSession, requireRole, requireSession } from './modules/auth/session.js'
import { hashPassword, randomToken } from './utils/crypto.js'

export async function createApp(database: PrismaClient, config: Config) {
  const dummyHash = await hashPassword(randomToken())
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY_HOPS || false)
  app.use(trackRequest)
  app.use(helmet({
    strictTransportSecurity: config.NODE_ENV === 'production' ? { maxAge: 31536000 } : false,
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] } },
    referrerPolicy: { policy: 'no-referrer' },
  }))
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', sameOrigin(config.PUBLIC_ORIGIN))
  app.use('/api', express.json({ limit: '32kb', strict: true }))

  app.get(['/api/health', '/api/health/live'], (_request, response) => {
    response.json({ status: 'ok' })
  })
  app.get('/api/health/ready', async (_request, response) => {
    try {
      const [migration] = await database.$queryRaw<{ ready: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM "_prisma_migrations"
          WHERE migration_name = '20261127000000_foundation' AND finished_at IS NOT NULL AND rolled_back_at IS NULL
        ) AS ready
      `
      if (!migration?.ready) { response.status(503).json({ status: 'unavailable' }); return }
      response.json({ status: 'ready' })
    } catch {
      response.status(503).json({ status: 'unavailable' })
    }
  })

  app.use('/api/auth', authRoutes(database, config, dummyHash))
  app.use('/api/admin', requireSession(database, config))
  app.get('/api/admin/access', requireRole('ADMIN'), (_request, response) => {
    response.json({ data: { role: currentSession(response).user.role } })
  })
  app.use((_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.')))
  app.use(handleError)
  return app
}
