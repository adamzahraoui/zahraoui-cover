import { randomUUID } from 'node:crypto'
import type { Document, Prisma, PrismaClient } from '@prisma/client'
import express from 'express'
import type { Request, Response, RequestHandler } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { requireAttempt, takeAttempt } from '../auth/limits.js'
import { currentSession } from '../auth/session.js'
import { versionField } from '../business-inputs.js'
import { contractConflict, coverageStatus, lockContract } from '../contracts/model.js'
import { maxPdfBytes, pdfDigest, privateDirectory, publishPdf, quotePdfEnabled, removePdf } from '../quotes/files.js'
import { staffAudit, staleRecord } from '../staff-records.js'
import { documentName, validPolicyPdf } from './validation.js'

export const uploadKinds = z.enum(['CONTRACT_PDF', 'CONTRACT_SUPPORT', 'BUSINESS_PDF'])
export const uploadVersion = z.string().regex(/^\d+$/).transform(Number).pipe(versionField)
export const pdfBody = express.raw({ type: 'application/pdf', limit: maxPdfBytes, inflate: false })

export function limitUpload(db: PrismaClient, config: Config): RequestHandler {
  return async (_request, response, next) => {
    if (!quotePdfEnabled(config)) throw new ApiError(503, 'POLICY_UPLOAD_DISABLED', 'Le dépôt de documents est indisponible.')
    requireAttempt(response, await takeAttempt(db, config.RATE_KEY_SECRET, 'document-upload', currentSession(response).user.id, 30, 15 * 60_000))
    next()
  }
}

type Attachment = { contractId: string; clientId?: string; version: number; kind: z.infer<typeof uploadKinds>; requireName?: boolean }

export async function attachPdf<T>(db: PrismaClient, config: Config, request: Request, response: Response, input: Attachment,
  result: (transaction: Prisma.TransactionClient, document: Document) => Promise<T>) {
  if (!request.is('application/pdf')) throw new ApiError(415, 'POLICY_PDF_REQUIRED', 'Seuls les PDF sont acceptés.')
  const name = documentName(request.get('X-Document-Filename'), Boolean(input.requireName))
  const bytes = request.body
  if (!Buffer.isBuffer(bytes) || !validPolicyPdf(bytes)) throw new ApiError(422, 'INVALID_POLICY_PDF', 'Le fichier ne correspond pas à un PDF admissible.')
  const digest = pdfDigest(bytes)
  const directory = await privateDirectory(config).catch(() => {
    throw new ApiError(503, 'DOCUMENT_UNAVAILABLE', 'Le stockage des documents est temporairement indisponible.')
  })
  const id = randomUUID()
  const key = id + '.pdf'
  let attemptedPublish = false
  try {
    return await db.$transaction(async transaction => {
      await lockContract(transaction, input.contractId)
      const contract = await transaction.contract.findUniqueOrThrow({ where: { id: input.contractId } })
      if (input.clientId && contract.clientId !== input.clientId) {
        throw new ApiError(422, 'DOCUMENT_ASSOCIATION', 'Le contrat ne correspond pas au client choisi.')
      }
      if (contract.version !== input.version) throw staleRecord()
      if (!['DRAFT', 'ACTIVE', 'SCHEDULED'].includes(coverageStatus(contract))) throw contractConflict('Ce contrat n’accepte plus de pièces.')
      const where = { contractId: contract.id, kind: input.kind }
      if (await transaction.document.findFirst({ where: { ...where, sha256: digest }, select: { id: true } })) {
        throw new ApiError(409, 'DOCUMENT_DUPLICATE', 'Ce PDF est déjà enregistré dans cette catégorie pour ce contrat.')
      }
      const latest = await transaction.document.findFirst({ where: { contractId: contract.id }, orderBy: { revision: 'desc' }, select: { revision: true } })
      if ((latest?.revision ?? 0) >= 100) throw contractConflict('Le nombre maximal de pièces est atteint.')
      attemptedPublish = true
      let stored: Buffer
      try {
        stored = await publishPdf(directory, key, bytes)
        if (!pdfDigest(stored).equals(digest)) throw new Error('Unexpected PDF digest')
      } catch {
        throw new ApiError(503, 'DOCUMENT_UNAVAILABLE', 'Le stockage des documents est temporairement indisponible.')
      }
      const document = await transaction.document.create({ data: {
        ...where, id, originalName: name, uploadedBy: currentSession(response).user.id, status: 'READY',
        revision: (latest?.revision ?? 0) + 1, mimeType: 'application/pdf', storageKey: key, sha256: digest,
        sizeBytes: BigInt(stored.length), readyAt: new Date(),
      } })
      await transaction.contract.update({ where: { id: contract.id }, data: { version: { increment: 1 } } })
      await staffAudit(transaction, response, 'contract', contract.id, 'CONTRACT_DOCUMENT_ATTACHED', { documentId: id })
      await staffAudit(transaction, response, 'document', id, 'DOCUMENT_UPLOADED')
      return result(transaction, document)
    }, { timeout: 10_000 })
  } catch (error) {
    if (attemptedPublish) {
      try {
        // Check the committed row before trying to remove an orphan after an uncertain commit.
        if (!await db.document.count({ where: { id } })) await removePdf(directory, key)
      } catch (cleanup) {
        if ((cleanup as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(JSON.stringify({ event: 'document_cleanup_pending', documentId: id }))
        }
      }
    }
    throw error
  }
}
