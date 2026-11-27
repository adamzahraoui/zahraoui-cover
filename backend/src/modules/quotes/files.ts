import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { link, mkdir, open, realpath, stat, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'

const keyPattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.pdf$/
export const maxPdfBytes = 4 * 1024 * 1024
const moduleRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const workspace = basename(resolve(moduleRoot)) === 'backend' ? dirname(resolve(moduleRoot)) : resolve(moduleRoot)

export function quotePdfEnabled(config: Config) {
  return config.NODE_ENV !== 'production' && Boolean(config.QUOTE_PDF_DIR && isAbsolute(config.QUOTE_PDF_DIR))
}

export async function privateDirectory(config: Config) {
  if (!quotePdfEnabled(config) || !config.QUOTE_PDF_DIR) throw new ApiError(503, 'QUOTE_PDF_DISABLED', 'La génération de devis est indisponible.')
  const configured = resolve(config.QUOTE_PDF_DIR)
  function outsideWorkspace(directory: string) {
    const path = relative(workspace, directory)
    if (!path || (!path.startsWith('../') && !isAbsolute(path))) throw new Error('Quote storage must be outside the workspace')
  }
  outsideWorkspace(configured)
  await mkdir(configured, { mode: 0o700, recursive: true })
  const directory = await realpath(configured)
  outsideWorkspace(directory)
  const info = await stat(directory)
  if (!info.isDirectory() || (info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid())) throw new Error('Quote storage is not private')
  return directory
}

function filePath(directory: string, key: string) {
  if (!keyPattern.test(key)) throw new Error('Invalid document key')
  return resolve(directory, key)
}

export function pdfDigest(data: Buffer) {
  return createHash('sha256').update(data).digest()
}

export async function readPdf(directory: string, key: string, expected?: { sha256: Uint8Array; sizeBytes: bigint }) {
  const file = await open(filePath(directory, key), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size < 5 || info.size > maxPdfBytes || (info.mode & 0o077) !== 0) throw new Error('Invalid quote file')
    const bytes = await file.readFile()
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || (expected &&
        (BigInt(bytes.length) !== expected.sizeBytes || !pdfDigest(bytes).equals(expected.sha256)))) throw new Error('Invalid PDF integrity')
    return bytes
  } finally { await file.close() }
}

export async function publishPdf(directory: string, key: string, bytes: Buffer) {
  const destination = filePath(directory, key)
  const temporary = resolve(directory, randomUUID() + '.tmp')
  const file = await open(temporary, 'wx', 0o600)
  try {
    try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
    try { await link(temporary, destination) }
    catch (error) {
      // A previous lease can have published the same frozen document before the database commit.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    const folder = await open(directory, 'r')
    try { await folder.sync() } finally { await folder.close() }
    return await readPdf(directory, key)
  } finally { await unlink(temporary) }
}

export async function removePdf(directory: string, key: string) {
  await unlink(filePath(directory, key))
}
