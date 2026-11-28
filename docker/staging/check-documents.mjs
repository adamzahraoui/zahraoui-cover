import { loadConfig } from './dist/src/config/env.js'
import { connectPrisma } from './dist/src/database/prisma.js'
import { privateDirectory, readPdf } from './dist/src/modules/quotes/files.js'

const config = loadConfig()
const database = connectPrisma(config.DATABASE_URL)
try {
  const directory = await privateDirectory(config)
  const documents = await database.document.findMany({
    where: { status: 'READY' },
    select: { storageKey: true, sha256: true, sizeBytes: true, quoteId: true, contractId: true },
  })
  let bytes = 0
  for (const document of documents) {
    const { storageKey, sha256, sizeBytes, quoteId, contractId } = document
    if (!storageKey || !sha256 || !sizeBytes || Boolean(quoteId) === Boolean(contractId)) {
      throw new Error('Invalid document metadata')
    }
    bytes += (await readPdf(directory, storageKey, { sha256, sizeBytes })).length
  }
  console.log(JSON.stringify({ documents: documents.length, bytes }))
} catch {
  console.error('Document integrity validation failed.')
  process.exitCode = 1
} finally {
  await database.$disconnect()
}
