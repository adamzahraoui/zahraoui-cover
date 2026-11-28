import { loadConfig } from './dist/src/config/env.js'
import { connectPrisma } from './dist/src/database/prisma.js'
import { privateDirectory } from './dist/src/modules/quotes/files.js'

const config = loadConfig()
const database = connectPrisma(config.DATABASE_URL)
try {
  await database.$queryRaw`SELECT 1`
  await privateDirectory(config)
  const mailpit = await fetch('http://mailpit:8025/livez', { signal: AbortSignal.timeout(2000) })
  if (!mailpit.ok) process.exitCode = 1
} catch {
  process.exitCode = 1
} finally {
  await database.$disconnect()
}
