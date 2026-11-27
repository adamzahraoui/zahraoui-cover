import type { Prisma, PrismaClient, StaffRole } from '@prisma/client'
import type { Request, RequestHandler, Response } from 'express'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { csrfFor, digestToken, tokenFormat, validCsrf } from '../../utils/crypto.js'

export const idleMs = 30 * 60 * 1000
export const absoluteMs = 12 * 60 * 60 * 1000
const touchIntervalMs = 60 * 1000

export const staffSelect = {
  id: true, email: true, displayName: true, role: true, isActive: true,
} satisfies Prisma.StaffUserSelect

const sessionInclude = { staff: { select: staffSelect } } satisfies Prisma.AdminSessionInclude
type SessionRow = Prisma.AdminSessionGetPayload<{ include: typeof sessionInclude }>

export type Session = {
  id: string
  user: { id: string; email: string; displayName: string; role: StaffRole }
  expiresAt: Date
  csrfToken: string
}

declare module 'express-serve-static-core' {
  interface Locals {
    requestId: string
    session?: Session
  }
}

function cookieName(config: Config) {
  return config.PUBLIC_ORIGIN.startsWith('https://') ? '__Host-zc_session' : 'zc_session'
}

function cookieOptions(config: Config) {
  return { httpOnly: true, sameSite: 'lax', secure: config.PUBLIC_ORIGIN.startsWith('https://'), path: '/' } as const
}

export function readSessionToken(request: Request, config: Config) {
  const name = cookieName(config) + '='
  const matches = (request.get('Cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name))
  const token = matches.length === 1 ? matches[0].slice(name.length) : ''
  return tokenFormat.test(token) ? token : undefined
}

export function writeSessionCookie(response: Response, config: Config, token: string) {
  response.cookie(cookieName(config), token, { ...cookieOptions(config), maxAge: absoluteMs })
}

export function clearSessionCookie(response: Response, config: Config) {
  response.clearCookie(cookieName(config), cookieOptions(config))
}

export function authResponse(session: Session) {
  return { ...session.user, expiresAt: session.expiresAt.toISOString(), csrfToken: session.csrfToken }
}

export function sessionFrom(row: SessionRow, token: string, config: Config): Session {
  const { id, email, displayName, role } = row.staff
  return {
    id: row.id,
    user: { id, email, displayName, role },
    expiresAt: new Date(Math.min(row.expiresAt.getTime(), row.lastSeenAt.getTime() + idleMs)),
    csrfToken: csrfFor(config.CSRF_SECRET, token),
  }
}

export function unauthorized() {
  return new ApiError(401, 'UNAUTHENTICATED', 'Votre session a expiré ou vous devez vous connecter.')
}

export function currentSession(response: Response): Session {
  if (!response.locals.session) throw unauthorized()
  return response.locals.session
}

function active(row: SessionRow | null, now: Date): row is SessionRow {
  return Boolean(row?.staff.isActive && !row.revokedAt && row.expiresAt > now && row.lastSeenAt.getTime() > now.getTime() - idleMs)
}

export function requireSession(database: PrismaClient, config: Config): RequestHandler {
  return async (request, response, next) => {
    const token = readSessionToken(request, config)
    if (!token) throw unauthorized()
    const where = { tokenHash: digestToken(token) }
    const now = new Date()
    let row = await database.adminSession.findUnique({ where, include: sessionInclude })
    if (!active(row, now)) {
      clearSessionCookie(response, config)
      throw unauthorized()
    }
    if (now.getTime() - row.lastSeenAt.getTime() >= touchIntervalMs) {
      const touched = await database.adminSession.updateMany({
        where: { id: row.id, lastSeenAt: row.lastSeenAt, revokedAt: null, expiresAt: { gt: now } },
        data: { lastSeenAt: now },
      })
      if (touched.count) row.lastSeenAt = now
      else row = await database.adminSession.findUnique({ where, include: sessionInclude })
      if (!active(row, now)) {
        clearSessionCookie(response, config)
        throw unauthorized()
      }
    }
    response.locals.session = sessionFrom(row, token, config)
    next()
  }
}

export function requireRole(role: StaffRole): RequestHandler {
  return (_request, response, next) => {
    if (currentSession(response).user.role !== role) throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé.')
    next()
  }
}

export const requireCsrf: RequestHandler = (request, response, next) => {
  if (!validCsrf(currentSession(response).csrfToken, request.get('X-CSRF-Token'))) {
    throw new ApiError(403, 'CSRF_FAILED', 'Vérification de la requête impossible. Actualisez la page.')
  }
  next()
}
