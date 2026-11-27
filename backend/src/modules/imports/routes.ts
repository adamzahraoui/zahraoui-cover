import { createHash } from 'node:crypto'
import { ImportKind, Prisma } from '@prisma/client'
import type { ImportJob, PrismaClient } from '@prisma/client'
import express, { Router } from 'express'
import type { Request, Response, RequestHandler } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { requireAttempt, takeAttempt } from '../auth/limits.js'
import { currentSession, requireCsrf, requireRole } from '../auth/session.js'
import { pageBounds, pagination, parseQuery, versionField } from '../business-inputs.js'
import { staffAudit, staleRecord } from '../staff-records.js'
import { fields, recommended, selectionSchema } from './columns.js'
import { evaluate, saveRecord } from './records.js'
import { mime, readSpreadsheet, uploadBytes, writeSpreadsheet } from './spreadsheets.js'
import type { Format } from './spreadsheets.js'

const kindSchema = z.enum(ImportKind)
export const outputFormat = z.enum(['csv', 'xlsx'])
const version = z.string().regex(/^\d+$/).transform(Number).pipe(versionField)
const reviewedSelection = selectionSchema.extend({ reviewHash: z.string().length(64) })
const expiryMs = 30 * 60_000
const rawSpreadsheet = express.raw({ type: [mime.xlsx, mime.csv, 'application/octet-stream'], limit: uploadBytes, inflate: false })
const include = { administrator: { select: { displayName: true } } } as const
const target: Record<ImportKind, string> = { CLIENTS: 'client', PARTNERS: 'partner', CONTRACTS: 'contract' }

function hash(bytes: Buffer | string) {
  return createHash('sha256').update(bytes).digest('hex')
}

function owned(id: string, response: Response) {
  return { id, administratorId: currentSession(response).user.id }
}

function requireJob<T extends ImportJob>(job: T | null): T {
  if (!job) throw new ApiError(404, 'NOT_FOUND', 'Import introuvable.')
  return job
}

function active(job: ImportJob) {
  if (job.status === 'EXPIRED' || job.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(410, 'IMPORT_EXPIRED', 'Cet aperçu a expiré. Déposez à nouveau le fichier.')
  }
}

function publicJob(job: ImportJob & { administrator: { displayName: string } }) {
  return {
    id: job.id, kind: job.kind, format: job.format,
    status: job.status !== 'COMPLETED' && job.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : job.status,
    version: job.version, createdAt: job.createdAt, expiresAt: job.expiresAt, completedAt: job.completedAt,
    administrator: job.administrator.displayName, counts: job.counts, createdRecords: job.createdRecords,
    diagnostics: job.expiresAt.getTime() > Date.now() ? job.diagnostics : null,
  }
}

export function download(response: Response, format: Format, name: string, bytes: Buffer) {
  response.set('Content-Disposition', 'attachment; filename="' + name + '.' + format + '"')
  response.type(mime[format]).send(bytes)
}

export function limitSpreadsheet(db: PrismaClient, config: Config, scope: string, maximum: number): RequestHandler {
  return async (_request, response, next) => {
    requireAttempt(response, await takeAttempt(db, config.RATE_KEY_SECRET, scope, currentSession(response).user.id, maximum, 15 * 60_000))
    next()
  }
}

function inputFile(request: Request, format: Format) {
  if (!request.is(mime[format]) && !request.is('application/octet-stream')) {
    throw new ApiError(415, 'IMPORT_FORMAT', 'Le type de contenu ne correspond pas au format CSV ou XLSX choisi.')
  }
  if (!Buffer.isBuffer(request.body) || !request.body.length) throw new ApiError(422, 'IMPORT_EMPTY', 'Sélectionnez un fichier CSV ou XLSX.')
  return request.body as Buffer
}

function sameFile(request: Request, job: ImportJob) {
  const bytes = inputFile(request, outputFormat.parse(job.format))
  if (hash(bytes) !== job.digest) throw new ApiError(409, 'IMPORT_FILE_CHANGED', 'Utilisez le fichier d’origine ou recommencez l’import.')
  return bytes
}

function review(evaluated: Awaited<ReturnType<typeof evaluate>>) {
  // The source digest fixes cell values. Include resolved relation IDs so a changed link requires a new review.
  const links = evaluated.valid.flatMap(({ line, record }) => record.kind === 'CONTRACTS'
    ? [[line, record.input.clientId, record.input.partnerId, record.input.productSlug]] : [])
  return hash(JSON.stringify([evaluated.rows, links]))
}

export async function expireImports(db: PrismaClient) {
  const expiresAt = { lte: new Date() }
  await db.importJob.updateMany({ where: { expiresAt, status: { in: ['UPLOADED', 'VALIDATED'] } },
    data: { status: 'EXPIRED', diagnostics: Prisma.DbNull } })
  await db.importJob.updateMany({ where: { expiresAt, diagnostics: { not: Prisma.DbNull } }, data: { diagnostics: Prisma.DbNull } })
}

export function importRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  routes.use(requireRole('ADMIN'))
  routes.get('/templates/:type', limitSpreadsheet(db, config, 'spreadsheet-template', 60), async (request, response) => {
    const kind = parseQuery(kindSchema, request.params.type)
    const { format = 'xlsx' } = parseQuery(z.strictObject({ format: outputFormat.optional() }), request.query)
    download(response, format, 'modele-' + kind.toLowerCase(), await writeSpreadsheet(format, fields[kind].map(field => field.label), [], 'Import'))
  })

  routes.get('/', async (request, response) => {
    const input = parseQuery(z.strictObject({ page: pagination.page, limit: pagination.limit, kind: kindSchema.optional() }), request.query)
    const { page, limit, skip } = pageBounds(input)
    const where = { administratorId: currentSession(response).user.id, kind: input.kind }
    const [rows, total] = await db.$transaction([
      db.importJob.findMany({ where, skip, take: limit, include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      db.importJob.count({ where }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(job => ({ ...publicJob(job), diagnostics: null, createdRecords: null })), meta: { page, limit, total },
      importEnabled: config.NODE_ENV !== 'production' })
  })
  const local: RequestHandler = (_request, _response, next) => {
    if (config.NODE_ENV === 'production') throw new ApiError(503, 'IMPORT_DISABLED', 'Les imports sont réservés aux essais locaux.')
    next()
  }
  const mutate = [requireCsrf, local, limitSpreadsheet(db, config, 'spreadsheet-import', 90), rawSpreadsheet]
  routes.post('/', ...mutate, async (request, response) => {
    const { kind, format } = parseQuery(z.strictObject({ kind: kindSchema, format: outputFormat }), request.query)
    const name = request.get('X-Import-Filename')
    let validName = false
    try {
      const decoded = decodeURIComponent(name ?? '')
      validName = decoded.length > format.length + 1 && decoded.length <= 180 && !/[\p{Cc}\p{Cf}/\\]/u.test(decoded) && decoded.toLowerCase().endsWith('.' + format)
    } catch { /* malformed header */ }
    if (!validName) throw new ApiError(422, 'IMPORT_FILENAME', 'Choisissez un fichier dont l’extension correspond au format.')
    const bytes = inputFile(request, format)
    const { sheets } = await readSpreadsheet(bytes, format)
    if (!sheets.some(sheet => sheet.headers.some(Boolean) && sheet.rows.length)) throw new ApiError(422, 'IMPORT_EMPTY', 'Ajoutez un en-tête et des lignes au fichier.')
    const digest = hash(bytes)
    const result = await db.$transaction(async transaction => {
      const prior = await transaction.importJob.count({ where: { kind, digest, status: 'COMPLETED' } })
      const job = await transaction.importJob.create({ data: {
        kind, format, digest, administratorId: currentSession(response).user.id, expiresAt: new Date(Date.now() + expiryMs),
      }, include })
      await staffAudit(transaction, response, 'import', job.id, 'IMPORT_UPLOADED', { kind, format })
      return { ...publicJob(job), previouslyImported: prior > 0 }
    })
    response.status(201).json({ data: { ...result, fields: fields[kind],
      sheets: sheets.map(sheet => ({ name: sheet.name, headers: sheet.headers, suggested: recommended(kind, sheet.headers) })) } })
  })

  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    response.json({ data: publicJob(requireJob(await db.importJob.findFirst({ where: owned(id, response), include }))) })
  })
  routes.post('/:id/validate', ...mutate, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const input = parseQuery(z.strictObject({ version }), request.query)
    let header: unknown
    try { header = JSON.parse(decodeURIComponent(request.get('X-Import-Selection') ?? '')) } catch { /* malformed header */ }
    const selection = parseQuery(selectionSchema, header)
    const where = owned(id, response)
    const job = requireJob(await db.importJob.findFirst({ where }))
    active(job)
    if (job.version !== input.version || job.status === 'COMPLETED') throw staleRecord()
    const { sheets, date1904 } = await readSpreadsheet(sameFile(request, job), outputFormat.parse(job.format))
    const sheet = sheets[selection.sheet]
    if (!sheet) throw new ApiError(422, 'IMPORT_SHEET', 'Sélectionnez une feuille du classeur.')
    const data = await db.$transaction(async transaction => {
      const evaluation = await evaluate(transaction, job.kind, sheet, selection, date1904)
      const updated = await transaction.importJob.updateMany({ where: { ...where, version: job.version, expiresAt: { gt: new Date() } }, data: {
        status: 'VALIDATED', version: { increment: 1 }, counts: evaluation.counts, diagnostics: evaluation.rows, selection: { ...selection, reviewHash: review(evaluation) },
      } })
      if (!updated.count) throw staleRecord()
      await staffAudit(transaction, response, 'import', id, 'IMPORT_VALIDATED', { kind: job.kind, ...evaluation.counts })
      return publicJob(await transaction.importJob.findUniqueOrThrow({ where: { id }, include }))
    }, { timeout: 25_000 })
    response.json({ data })
  })
  routes.post('/:id/confirm', ...mutate, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const input = parseQuery(z.strictObject({ version, confirmed: z.literal('true') }), request.query)
    const where = owned(id, response)
    const initial = requireJob(await db.importJob.findFirst({ where, include }))
    const bytes = sameFile(request, initial)
    if (initial.status === 'COMPLETED') { response.json({ data: publicJob(initial) }); return }
    active(initial)
    const { sheets, date1904 } = await readSpreadsheet(bytes, outputFormat.parse(initial.format))
    try {
      const data = await db.$transaction(async transaction => {
        const author = where.administratorId
        const [authorized] = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id FROM staff_users WHERE id=${author}::uuid AND role='ADMIN' AND is_active FOR SHARE
        `
        if (!authorized) throw new ApiError(403, 'FORBIDDEN', 'Action réservée aux administrateurs.')
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('spreadsheet-confirm', 0))`
        await transaction.$queryRaw`SELECT id FROM import_jobs WHERE id=${id}::uuid FOR UPDATE`
        const job = requireJob(await transaction.importJob.findFirst({ where, include }))
        if (job.status === 'COMPLETED') return publicJob(job)
        active(job)
        if (job.version !== input.version || job.status !== 'VALIDATED') throw staleRecord()
        const selection = reviewedSelection.parse(job.selection)
        const evaluation = await evaluate(transaction, job.kind, sheets[selection.sheet], selection, date1904)
        if (review(evaluation) !== selection.reviewHash) throw new ApiError(409, 'IMPORT_REVIEW_CHANGED', 'Les dossiers ont changé. Validez à nouveau avant de confirmer.')
        if (evaluation.counts.rejected > 0) throw new ApiError(409, 'IMPORT_INVALID_ROWS', 'Corrigez les lignes invalides avant la confirmation.')
        const createdRecords = []
        for (const { line, record } of evaluation.valid) {
          const saved = await saveRecord(transaction, record, author)
          createdRecords.push({ line, id: saved.id })
          await staffAudit(transaction, response, target[job.kind], saved.id, 'RECORD_IMPORTED', { importId: id })
        }
        const counts = { ...evaluation.counts, created: createdRecords.length }
        const complete = await transaction.importJob.update({ where: { id }, include, data: {
          status: 'COMPLETED', completedAt: new Date(), version: { increment: 1 }, counts, createdRecords,
        } })
        await staffAudit(transaction, response, 'import', id, 'IMPORT_COMPLETED', { kind: job.kind, ...counts })
        return publicJob(complete)
      }, { timeout: 30_000, maxWait: 10_000 })
      response.json({ data })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2004', 'P2028', 'P2034'].includes(error.code)) {
        throw new ApiError(409, 'IMPORT_CONFLICT', 'L’import a été annulé. Vérifiez les conflits et validez le fichier à nouveau.')
      }
      if (error instanceof ApiError) throw error
      console.error(JSON.stringify({ event: 'import_confirmation_failed', importId: id, requestId: response.locals.requestId }))
      throw new ApiError(503, 'IMPORT_UNAVAILABLE', 'La confirmation est indisponible. Vérifiez l’historique avant de réessayer.')
    }
  })
  routes.get('/:id/errors', limitSpreadsheet(db, config, 'spreadsheet-export', 30), async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const job = requireJob(await db.importJob.findFirst({ where: owned(id, response) }))
    active(job)
    const diagnostics = z.array(z.object({ line: z.number(), state: z.string(), code: z.string().optional(), field: z.string().optional() })).safeParse(job.diagnostics).data
    if (!diagnostics) throw new ApiError(409, 'IMPORT_NOT_VALIDATED', 'Validez le fichier avant de demander le rapport.')
    await staffAudit(db, response, 'import', id, 'IMPORT_ERRORS_EXPORTED')
    const rows = diagnostics.filter(row => row.code).map(row => [String(row.line), row.state, row.code ?? '', row.field ?? ''])
    download(response, 'csv', 'rapport-import', await writeSpreadsheet('csv', ['Ligne', 'État', 'Code', 'Champ'], rows, 'Erreurs'))
  })
  return routes
}
