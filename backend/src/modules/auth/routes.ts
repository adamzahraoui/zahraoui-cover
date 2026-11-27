import { setTimeout as delay } from 'node:timers/promises'
import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import type { Request } from 'express'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { digestToken, hashPassword, passwordMatches, randomToken } from '../../utils/crypto.js'
import { audit } from './audit.js'
import { changePasswordInput, forgotInput, loginInput, resetInput } from './contracts.js'
import { releaseAttempt, requireAttempt, takeAttempt } from './limits.js'
import { lockStaff, queueReset } from './recovery.js'
import {
  absoluteMs, authResponse, clearSessionCookie, currentSession, idleMs, readSessionToken, requireCsrf,
  requireSession, sessionFrom, staffSelect, unauthorized, writeSessionCookie,
} from './session.js'

const quarterHour = 15 * 60 * 1000
const hour = 60 * 60 * 1000
const source = (request: Request) => request.ip ?? request.socket.remoteAddress ?? 'unknown'
const invalidLogin = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Adresse email ou mot de passe incorrect.')
const invalidReset = () => new ApiError(422, 'RESET_INVALID', 'Ce lien est invalide ou a expiré.')

export function authRoutes(database: PrismaClient, config: Config, dummyHash: string) {
  const routes = Router()
  const signedIn = requireSession(database, config)
  const limit = config.RATE_KEY_SECRET

  routes.post('/login', async (request, response) => {
    const input = jsonBody(request, loginInput)
    const requestId = response.locals.requestId
    requireAttempt(response, await takeAttempt(database, limit, 'login_source', source(request), 20, quarterHour))
    const accountAttempt = await takeAttempt(database, limit, 'login_account', input.email, 5, quarterHour)
    requireAttempt(response, accountAttempt)

    const staff = await database.staffUser.findUnique({ where: { email: input.email } })
    const verified = await passwordMatches(staff?.isActive && staff.passwordHash ? staff.passwordHash : dummyHash, input.password)
    if (!staff?.isActive || !staff.passwordHash || !verified) {
      await audit(database, 'AUTH_LOGIN', requestId, staff?.id, 'REJECTED')
      throw invalidLogin()
    }

    const token = randomToken()
    const previousToken = readSessionToken(request, config)
    const session = await database.$transaction(async transaction => {
      const current = await lockStaff(transaction, staff.id)
      if (!current?.isActive || current.passwordHash !== staff.passwordHash || current.email !== input.email) {
        await audit(transaction, 'AUTH_LOGIN', requestId, staff.id, 'STALE')
        return null
      }

      const now = new Date()
      if (previousToken) {
        await transaction.adminSession.updateMany({
          where: { tokenHash: digestToken(previousToken), revokedAt: null },
          data: { revokedAt: now },
        })
      }
      const row = await transaction.adminSession.create({
        data: { staffId: staff.id, tokenHash: digestToken(token), lastSeenAt: now, expiresAt: new Date(now.getTime() + absoluteMs) },
        include: { staff: { select: staffSelect } },
      })
      await releaseAttempt(transaction, accountAttempt)
      await audit(transaction, 'AUTH_LOGIN', requestId, staff.id)
      return sessionFrom(row, token, config)
    })
    if (!session) throw invalidLogin()
    writeSessionCookie(response, config, token)
    response.json({ data: authResponse(session) })
  })

  routes.get('/session', signedIn, (_request, response) => {
    response.json({ data: authResponse(currentSession(response)) })
  })

  routes.post('/logout', signedIn, requireCsrf, async (_request, response) => {
    const session = currentSession(response)
    await database.$transaction(async transaction => {
      await transaction.adminSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } })
      await audit(transaction, 'AUTH_LOGOUT', response.locals.requestId, session.user.id)
    })
    clearSessionCookie(response, config)
    response.status(204).end()
  })

  routes.post('/forgot-password', async (request, response) => {
    const start = performance.now()
    const input = jsonBody(request, forgotInput)
    requireAttempt(response, await takeAttempt(database, limit, 'forgot_source', source(request), 5, hour))
    const account = await takeAttempt(database, limit, 'forgot_account', input.email, 3, hour)
    if (account.allowed && config.SMTP_MODE !== 'disabled') {
      const staff = await database.staffUser.findUnique({ where: { email: input.email }, select: { id: true, isActive: true } })
      if (staff?.isActive) {
        await database.$transaction(async transaction => {
          const current = await lockStaff(transaction, staff.id)
          if (current?.isActive && current.email === input.email) {
            await queueReset(transaction, config, staff.id, new Date())
            await audit(transaction, 'AUTH_RESET_REQUESTED', response.locals.requestId, staff.id)
          }
        })
      }
    }
    // Apply the same response and a timing floor to registered and unregistered addresses.
    await delay(Math.max(0, 150 - (performance.now() - start)))
    response.status(202).json({ data: { accepted: true } })
  })

  routes.post('/reset-password', async (request, response) => {
    const input = jsonBody(request, resetInput)
    requireAttempt(response, await takeAttempt(database, limit, 'reset_source', source(request), 15, quarterHour))
    const token = await database.passwordResetToken.findUnique({ where: { tokenHash: digestToken(input.token) } })
    if (!token || token.invalidatedAt || token.usedAt || token.expiresAt <= new Date()) throw invalidReset()

    const passwordHash = await hashPassword(input.password)
    const changed = await database.$transaction(async transaction => {
      const staff = await lockStaff(transaction, token.staffId)
      if (!staff?.isActive) return false
      const now = new Date()
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, invalidatedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (!consumed.count) return false
      // The credential-change database trigger revokes sessions and unused reset links in this transaction.
      await transaction.staffUser.update({ where: { id: staff.id }, data: { passwordHash, version: { increment: 1 } } })
      await audit(transaction, 'AUTH_PASSWORD_RESET', response.locals.requestId, staff.id)
      return true
    })
    if (!changed) throw invalidReset()
    clearSessionCookie(response, config)
    response.status(204).end()
  })

  routes.post('/change-password', signedIn, requireCsrf, async (request, response) => {
    const input = jsonBody(request, changePasswordInput)
    const session = currentSession(response)
    requireAttempt(response, await takeAttempt(database, limit, 'change_account', session.user.id, 5, quarterHour))
    const staff = await database.staffUser.findUnique({ where: { id: session.user.id } })
    if (!staff?.isActive || !staff.passwordHash) throw unauthorized()
    if (!await passwordMatches(staff.passwordHash, input.currentPassword)) {
      await audit(database, 'AUTH_PASSWORD_CHANGE', response.locals.requestId, staff.id, 'REJECTED')
      throw new ApiError(422, 'CURRENT_PASSWORD_INVALID', 'Le mot de passe actuel est incorrect.')
    }

    const passwordHash = await hashPassword(input.newPassword)
    await database.$transaction(async transaction => {
      const current = await lockStaff(transaction, staff.id)
      if (!current?.isActive || current.passwordHash !== staff.passwordHash) throw unauthorized()
      // Lock this session so logout and a password write cannot use the same session concurrently.
      const rows = await transaction.$queryRaw<{ id: string }[]>`
        SELECT id FROM admin_sessions
        WHERE id = ${session.id}::uuid AND revoked_at IS NULL AND expires_at > now()
          AND last_seen_at > ${new Date(Date.now() - idleMs)}
        FOR UPDATE
      `
      if (!rows.length) throw unauthorized()
      await transaction.staffUser.update({ where: { id: staff.id }, data: { passwordHash, version: { increment: 1 } } })
      await audit(transaction, 'AUTH_PASSWORD_CHANGE', response.locals.requestId, staff.id)
    })
    clearSessionCookie(response, config)
    response.status(204).end()
  })

  return routes
}
