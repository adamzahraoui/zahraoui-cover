import type { PrismaClient } from '@prisma/client'
import express from 'express'
import type { RequestHandler } from 'express'
import helmet from 'helmet'
import type { Config } from './config/env.js'
import { ApiError, handleError } from './middleware/errors.js'
import { sameOrigin, trackRequest } from './middleware/request.js'
import { authRoutes } from './modules/auth/routes.js'
import { currentSession, requireRole, requireSession } from './modules/auth/session.js'
import { adminCatalogRoutes, publicCatalogRoutes } from './modules/catalog/routes.js'
import { quoteIntakeRoutes } from './modules/quote-requests/intake.js'
import { quoteAdminRoutes, quoteSelectors } from './modules/quote-requests/admin.js'
import { clientRoutes } from './modules/clients/routes.js'
import { assistanceAdminRoutes, messageAdminRoutes } from './modules/support/admin.js'
import { supportIntakeRoutes } from './modules/support/intake.js'
import { issuedQuoteRoutes } from './modules/quotes/routes.js'
import { importRoutes } from './modules/imports/routes.js'
import { exportRoutes } from './modules/imports/exports.js'
import { documentRoutes } from './modules/documents/routes.js'
import { contractRoutes } from './modules/contracts/routes.js'
import { partnerAdminRoutes, publicPartnerRoutes } from './modules/partners/routes.js'
import { dashboardRoutes } from './modules/dashboard/routes.js'
import { agencyAdminRoutes, publicAgencyRoutes } from './modules/agency/routes.js'
import { staffAdminRoutes } from './modules/agency/staff.js'
import { permissionsPolicy, webPages } from './modules/web/pages.js'
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
  app.use((_request, response, next) => {
    response.set('Permissions-Policy', permissionsPolicy())
    next()
  })
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', sameOrigin(config.PUBLIC_ORIGIN))
  app.use('/api', express.json({ limit: '32kb', strict: true, inflate: false }))

  const liveness: RequestHandler = (_request, response) => {
    response.json({ status: 'ok' })
  }
  app.get('/api/health', liveness)
  app.get('/api/health/live', liveness)
  app.get('/api/health/ready', async (_request, response) => {
    try {
      const [migration] = await database.$queryRaw<{ ready: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM "_prisma_migrations"
          WHERE migration_name = '20261128080000_agency_administration' AND finished_at IS NOT NULL AND rolled_back_at IS NULL
        ) AS ready
      `
      if (!migration?.ready) { response.status(503).json({ status: 'unavailable' }); return }
      response.json({ status: 'ready' })
    } catch {
      response.status(503).json({ status: 'unavailable' })
    }
  })

  app.use('/api/auth', authRoutes(database, config, dummyHash))
  app.use('/api/catalog', publicCatalogRoutes(database))
  app.use('/api/quotes', quoteIntakeRoutes(database, config))
  app.use('/api/contact', supportIntakeRoutes(database, config, 'CONTACT'))
  app.use('/api/assistance', supportIntakeRoutes(database, config, 'ASSISTANCE'))
  app.use('/api/partners', publicPartnerRoutes(database))
  app.use('/api/agency', publicAgencyRoutes(database))
  app.use('/api/admin', requireSession(database, config))
  app.use('/api/admin/settings', agencyAdminRoutes(database, config))
  app.use('/api/admin/staff', staffAdminRoutes(database, config))
  app.use('/api/admin/catalog', adminCatalogRoutes(database))
  app.use('/api/admin/quote-requests', quoteAdminRoutes(database))
  app.use('/api/admin/clients', clientRoutes(database))
  app.use('/api/admin/assistance', assistanceAdminRoutes(database))
  app.use('/api/admin/messages', messageAdminRoutes(database))
  app.use('/api/admin/quotes', issuedQuoteRoutes(database, config))
  app.use('/api/admin/partners', partnerAdminRoutes(database))
  app.use('/api/admin/contracts', contractRoutes(database, config))
  app.use('/api/admin/imports', importRoutes(database, config))
  app.use('/api/admin/exports', exportRoutes(database, config))
  app.use('/api/admin/documents', documentRoutes(database, config))
  app.use('/api/admin/dashboard', dashboardRoutes(database))
  app.use('/api/admin', quoteSelectors(database))
  app.get('/api/admin/access', requireRole('ADMIN'), (_request, response) => {
    response.json({ data: { role: currentSession(response).user.role } })
  })
  if (config.FRONTEND_DIST_DIR) app.use(await webPages(database, config))
  app.use((_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.')))
  app.use(handleError)
  return app
}
