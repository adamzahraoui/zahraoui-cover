import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { displayNameField, emailField } from '../auth/contracts.js'
import { requireAttempt, takeAttempt } from '../auth/limits.js'
import { lockStaff, queueReset } from '../auth/recovery.js'
import { currentSession, idleMs, requireCsrf, requireRole, staffSelect } from '../auth/session.js'
import { pageBounds, pagination, parseQuery, searchPrefix, versionField } from '../business-inputs.js'
import { recordHistory, staffAudit, staleRecord } from '../staff-records.js'
import { localMail, lockAdmin } from './model.js'

const role = z.enum(['ADMIN', 'ADVISOR'])
const create = z.strictObject({ email: emailField, displayName: displayNameField, role })
const edit = z.strictObject({ version: versionField, displayName: displayNameField.optional(), role: role.optional(), isActive: z.boolean().optional() })
  .refine(value => Object.keys(value).length > 1)
const versioned = z.strictObject({ version: versionField })
const selected = { ...staffSelect, version: true, createdAt: true, passwordHash: true } satisfies Prisma.StaffUserSelect
type Account = Prisma.StaffUserGetPayload<{ select: typeof selected }>

function row({ passwordHash, ...account }: Account) {
  return { ...account, setupComplete: Boolean(passwordHash) }
}

async function detail(db: Prisma.TransactionClient, id: string) {
  const account = await db.staffUser.findUnique({ where: { id }, select: selected })
  if (!account) throw new ApiError(404, 'NOT_FOUND', 'Compte introuvable.')
  const now = new Date()
  const activeSessions = await db.adminSession.count({ where: { staffId: id, revokedAt: null, expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - idleMs) } } })
  const history = await recordHistory(db, 'staff_account', id)
  const auth = await db.auditEvent.findMany({ where: { actorId: id, action: { in: ['AUTH_LOGIN','AUTH_LOGOUT','AUTH_PASSWORD_RESET','AUTH_PASSWORD_CHANGE'] } },
    take: 15, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, action: true, createdAt: true, metadata: true },
  })
  return { ...row(account), activeSessions, activity: [...history, ...auth.map(event => ({
    id: event.id, action: event.action, createdAt: event.createdAt, actor: null,
    outcome: z.object({ outcome: z.enum(['SUCCESS','REJECTED','STALE']) }).safeParse(event.metadata).data?.outcome ?? null,
  }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20) }
}

async function staffLock(db: Prisma.TransactionClient, response: Response) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(381972, 1)`
  await lockAdmin(db, currentSession(response))
}

function requireLocalInvite(config: Config) {
  if (!localMail(config)) throw new ApiError(503, 'STAFF_INVITE_DISABLED', 'Les invitations sont disponibles uniquement avec le SMTP de test local.')
}

export function staffAdminRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  routes.use(requireRole('ADMIN'))
  routes.get('/', async (request, response) => {
    const input = parseQuery(z.strictObject({ ...pagination, role: role.optional(), active: z.enum(['true','false']).optional() }), request.query)
    const { page, limit, skip } = pageBounds(input)
    const q = input.q && searchPrefix(input.q)
    const where: Prisma.StaffUserWhereInput = { role: input.role, isActive: input.active === undefined ? undefined : input.active === 'true',
      OR: q ? [{ displayName: { startsWith: q, mode: 'insensitive' } }, { email: { startsWith: q, mode: 'insensitive' } }] : undefined }
    const [accounts, total] = await db.$transaction([
      db.staffUser.findMany({ where, skip, take: limit, select: selected, orderBy: [{ displayName: 'asc' }, { id: 'asc' }] }),
      db.staffUser.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: accounts.map(row), meta: { page, limit, total }, inviteEnabled: localMail(config) })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await db.$transaction(async transaction => {
      const account = await detail(transaction, id)
      await staffAudit(transaction, response, 'staff_account', id, 'RECORD_VIEWED')
      return account
    })
    response.json({ data })
  })
  routes.post('/', requireCsrf, async (request, response) => {
    requireLocalInvite(config)
    const input = jsonBody(request, create)
    requireAttempt(response, await takeAttempt(db, config.RATE_KEY_SECRET, 'staff-invite-actor', currentSession(response).user.id, 15, 3_600_000))
    try {
      const data = await db.$transaction(async transaction => {
        await staffLock(transaction, response)
        const account = await transaction.staffUser.create({ data: input, select: selected })
        await queueReset(transaction, config, account.id, new Date())
        await staffAudit(transaction, response, 'staff_account', account.id, 'STAFF_INVITED', { role: account.role })
        return row(account)
      })
      response.status(201).json({ data })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'STAFF_DUPLICATE', 'Un compte utilise déjà cette adresse.')
      }
      throw error
    }
  })
  routes.patch('/:id', requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version, ...changes } = jsonBody(request, edit)
    const data = await db.$transaction(async transaction => {
      await staffLock(transaction, response)
      const account = await lockStaff(transaction, id)
      if (!account) throw new ApiError(404, 'NOT_FOUND', 'Compte introuvable.')
      if (account.version !== version) throw staleRecord()
      if (account.isActive && account.role === 'ADMIN' && (changes.isActive === false || changes.role === 'ADVISOR')) {
        const others = await transaction.staffUser.count({ where: { id: { not: id }, isActive: true, role: 'ADMIN', passwordHash: { not: null } } })
        if (!others) throw new ApiError(409, 'LAST_ADMIN', 'Conservez un administrateur actif dont le compte est configuré.')
      }
      const updated = await transaction.staffUser.update({ where: { id }, data: { ...changes, version: { increment: 1 } }, select: selected })
      await staffAudit(transaction, response, 'staff_account', id, 'STAFF_UPDATED', { fields: Object.keys(changes), role: updated.role, isActive: updated.isActive })
      return row(updated)
    })
    response.json({ data })
  })

  for (const action of ['invite', 'revoke-sessions'] as const) {
    routes.post('/:id/' + action, requireCsrf, async (request, response) => {
      const id = parseQuery(z.uuid(), request.params.id)
      const { version } = jsonBody(request, versioned)
      if (action === 'invite') {
        requireLocalInvite(config)
        requireAttempt(response, await takeAttempt(db, config.RATE_KEY_SECRET, 'staff-invite-actor', currentSession(response).user.id, 15, 3_600_000))
        requireAttempt(response, await takeAttempt(db, config.RATE_KEY_SECRET, 'staff-invite-target', id, 3, 3_600_000))
      }
      const data = await db.$transaction(async transaction => {
        await staffLock(transaction, response)
        const account = await lockStaff(transaction, id)
        if (!account) throw new ApiError(404, 'NOT_FOUND', 'Compte introuvable.')
        if (account.version !== version) throw staleRecord()
        if (action === 'invite') {
          if (!account.isActive || account.passwordHash) throw new ApiError(409, 'STAFF_SETUP_STATE', 'Réinvitez uniquement les comptes actifs sans mot de passe.')
          await queueReset(transaction, config, id, new Date())
        } else {
          await transaction.adminSession.updateMany({ where: { staffId: id, revokedAt: null }, data: { revokedAt: new Date() } })
        }
        await transaction.staffUser.update({ where: { id }, data: { version: { increment: 1 } } })
        await staffAudit(transaction, response, 'staff_account', id, action === 'invite' ? 'STAFF_REINVITED' : 'STAFF_SESSIONS_REVOKED')
        return detail(transaction, id)
      })
      response.json({ data })
    })
  }
  return routes
}
