import { DocumentKind, DocumentStatus } from '@prisma/client'
import type { Prisma, PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { jsonBody } from '../../middleware/request.js'
import { requireCsrf, requireRole } from '../auth/session.js'
import { pageBounds, pagination, parseQuery, searchPrefix, versionField } from '../business-inputs.js'
import { privateDirectory, quotePdfEnabled, readPdf } from '../quotes/files.js'
import { dateRange, recordHistory, staffAudit, staleRecord } from '../staff-records.js'
import { attachPdf, limitUpload, pdfBody, uploadKinds, uploadVersion } from './uploads.js'

const filters = z.strictObject({
  ...pagination, kind: z.enum(DocumentKind).optional(), status: z.enum(DocumentStatus).optional(),
  archived: z.enum(['true', 'false', 'all']).optional(), clientId: z.uuid().optional(), quoteId: z.uuid().optional(),
  contractId: z.uuid().optional(), from: z.iso.date().optional(), to: z.iso.date().optional(),
}).refine(({ from, to }) => !from || !to || from <= to)
const upload = z.strictObject({ contractId: z.uuid(), clientId: z.uuid().optional(), version: uploadVersion, kind: uploadKinds })
const parent = { id: true, reference: true, client: { select: { id: true, displayName: true } } } as const
const metadataFields = {
  id: true, kind: true, status: true, revision: true, version: true, quoteVersion: true, originalName: true,
  sizeBytes: true, createdAt: true, readyAt: true, archivedAt: true,
  quote: { select: parent }, contract: { select: parent },
} satisfies Prisma.DocumentSelect

type Metadata = Prisma.DocumentGetPayload<{ select: typeof metadataFields }>

function missing() {
  return new ApiError(404, 'NOT_FOUND', 'Document introuvable.')
}

function referenceFilename(row: Pick<Metadata, 'kind' | 'revision' | 'quote' | 'contract'>) {
  const reference = (row.quote?.reference ?? row.contract?.reference ?? 'document').replace(/[^A-Za-z0-9-]/g, '_')
  return reference + (row.kind === 'QUOTE_PDF' ? '' : '-piece-' + row.revision) + '.pdf'
}

function canArchive(row: Pick<Metadata, 'archivedAt' | 'status' | 'kind'>) {
  return !row.archivedAt && row.status === 'READY' && (row.kind === 'CONTRACT_SUPPORT' || row.kind === 'BUSINESS_PDF')
}

function documentRow({ originalName, sizeBytes, ...row }: Metadata) {
  return {
    ...row, name: originalName ?? referenceFilename(row), sizeBytes: sizeBytes?.toString() ?? null,
    client: row.quote?.client ?? row.contract?.client ?? null,
    canPreview: row.kind === 'QUOTE_PDF' && row.status === 'READY', canArchive: canArchive(row),
  }
}

async function detail(db: Prisma.TransactionClient, id: string) {
  const row = await db.document.findUnique({ where: { id }, select: {
    ...metadataFields, mimeType: true, uploader: { select: { displayName: true } },
  } })
  if (!row) throw missing()
  return { ...documentRow(row), activity: await recordHistory(db, 'document', id) }
}

async function listFilter(db: PrismaClient, input: z.infer<typeof filters>): Promise<Prisma.DocumentWhereInput> {
  const contains = input.q ? { contains: searchPrefix(input.q), mode: 'insensitive' as const } : undefined
  const filenamePrefix = input.q?.replace(/\.pdf$/i, '').replace(/-piece-\d*$/i, '')
  const fileReference = filenamePrefix && filenamePrefix !== input.q ? { startsWith: searchPrefix(filenamePrefix), mode: 'insensitive' as const } : undefined
  return {
    kind: input.kind, status: input.status, quoteId: input.quoteId, contractId: input.contractId,
    archivedAt: input.archived === 'all' ? undefined : input.archived === 'true' ? { not: null } : null,
    createdAt: await dateRange(db, input.from, input.to),
    AND: [
      input.clientId ? { OR: [{ quote: { clientId: input.clientId } }, { contract: { clientId: input.clientId } }] } : {},
      contains ? { OR: [
        { originalName: contains }, { quote: { reference: contains } }, { contract: { reference: contains } },
        { quote: { client: { displayName: contains } } }, { contract: { client: { displayName: contains } } },
        ...(fileReference ? [{ quote: { reference: fileReference } }, { contract: { reference: fileReference } }] : []),
      ] } : {},
    ],
  }
}

export function documentRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  routes.get('/', async (request, response) => {
    const input = parseQuery(filters, request.query)
    const { page, limit, skip } = pageBounds(input)
    const where = await listFilter(db, input)
    const [rows, total, inventory] = await db.$transaction([
      db.document.findMany({ where, skip, take: limit, select: metadataFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      db.document.count({ where }),
      db.document.aggregate({ _count: true, _sum: { sizeBytes: true } }),
    ], { isolationLevel: 'RepeatableRead' })
    response.json({ data: rows.map(documentRow), meta: { page, limit, total },
      storage: { count: inventory._count, sizeBytes: inventory._sum.sizeBytes?.toString() ?? '0' }, uploadEnabled: quotePdfEnabled(config),
    })
  })
  routes.post('/', requireCsrf, limitUpload(db, config), pdfBody, async (request, response) => {
    const input = parseQuery(upload, request.query)
    const data = await attachPdf(db, config, request, response, { ...input, requireName: true },
      (transaction, document) => detail(transaction, document.id))
    response.status(201).json({ data })
  })
  routes.get('/:id', async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const data = await db.$transaction(async transaction => {
      const record = await detail(transaction, id)
      await staffAudit(transaction, response, 'document', id, 'RECORD_VIEWED')
      return record
    })
    response.json({ data })
  })
  routes.post('/:id/archive', requireRole('ADMIN'), requireCsrf, async (request, response) => {
    const id = parseQuery(z.uuid(), request.params.id)
    const { version } = jsonBody(request, z.strictObject({ version: versionField }))
    const data = await db.$transaction(async transaction => {
      const row = await transaction.document.findUnique({ where: { id } })
      if (!row) throw missing()
      if (row.version !== version) throw staleRecord()
      if (!canArchive(row)) throw new ApiError(409, 'DOCUMENT_ARCHIVE_FORBIDDEN', 'Ce document doit rester dans le dossier courant ou est déjà archivé.')
      const changed = await transaction.document.updateMany({ where: { id, version }, data: { archivedAt: new Date(), version: { increment: 1 } } })
      if (!changed.count) throw staleRecord()
      await staffAudit(transaction, response, 'document', id, 'DOCUMENT_ARCHIVED')
      return detail(transaction, id)
    })
    response.json({ data })
  })
  routes.get('/:id/download', async (request, response) => {
    const id = z.uuid().safeParse(request.params.id)
    if (!id.success) throw missing()
    const { inline } = parseQuery(z.strictObject({ inline: z.literal('true').optional() }), request.query)
    const document = await db.document.findUnique({ where: { id: id.data }, select: {
      ...metadataFields, storageKey: true, sha256: true,
    } })
    if (!document || (!document.quote && !document.contract) || (inline && document.kind !== 'QUOTE_PDF')) throw missing()
    if (document.status !== 'READY' || !document.storageKey || !document.sha256 || !document.sizeBytes) {
      throw new ApiError(409, 'DOCUMENT_NOT_READY', 'Ce PDF n’est pas prêt.')
    }
    let bytes: Buffer
    try {
      bytes = await readPdf(await privateDirectory(config), document.storageKey, { sha256: document.sha256, sizeBytes: document.sizeBytes })
    } catch {
      throw new ApiError(503, 'DOCUMENT_UNAVAILABLE', 'Le PDF est temporairement indisponible.')
    }
    await staffAudit(db, response, 'document', document.id, document.kind === 'QUOTE_PDF' ? 'QUOTE_DOCUMENT_VIEWED' : 'CONTRACT_DOCUMENT_VIEWED')
    const name = referenceFilename(document)
    response.set('Content-Disposition', (inline ? 'inline' : 'attachment') + '; filename="' + name + '"')
    response.type('application/pdf').send(bytes)
  })
  return routes
}
