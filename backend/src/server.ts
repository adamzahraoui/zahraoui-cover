import { loadConfig } from './config/env.js'
import { connectPrisma } from './database/prisma.js'
import { createApp } from './app.js'

async function start() {
  const config = loadConfig()
  const database = connectPrisma(config.DATABASE_URL)
  try {
    await database.$connect()
    const app = await createApp(database, config)
    const server = app.listen(config.PORT, config.HOST)
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    console.info(JSON.stringify({ event: 'api_listening', port: config.PORT }))

    let closing = false
    const stop = () => {
      if (closing) return
      closing = true
      const deadline = setTimeout(() => server.closeAllConnections(), 10_000)
      deadline.unref()
      server.close(error => {
        clearTimeout(deadline)
        database.$disconnect().catch(() => { process.exitCode = 1 }).finally(() => {
          if (error) process.exitCode = 1
        })
      })
    }
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, stop)
    server.on('error', () => { process.exitCode = 1; stop() })
  } catch {
    await database.$disconnect()
    throw new Error('API startup failed')
  }
}

start().catch(() => {
  console.error(JSON.stringify({ event: 'api_startup_failed' }))
  process.exitCode = 1
})
