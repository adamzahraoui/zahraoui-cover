import { setTimeout as delay } from 'node:timers/promises'
import { loadConfig } from './config/env.js'
import { connectPrisma } from './database/prisma.js'
import { cleanAuthRecords, deliverNextMail, smtpMailer } from './modules/notifications/mail-jobs.js'

async function run() {
  const config = loadConfig()
  const database = connectPrisma(config.DATABASE_URL)
  const mailer = smtpMailer(config)
  let stopping = false
  const stop = () => { stopping = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)

  try {
    await database.$connect()
    console.info(JSON.stringify({ event: 'mail_worker_started', smtpMode: config.SMTP_MODE }))
    let nextCleanup = 0
    while (!stopping) {
      try {
        if (Date.now() >= nextCleanup) {
          await cleanAuthRecords(database)
          nextCleanup = Date.now() + 60_000
        }
        if (mailer && !stopping && await deliverNextMail(database, config, mailer)) continue
      } catch {
        console.error(JSON.stringify({ event: 'mail_worker_iteration_failed' }))
      }
      if (!stopping) await delay(1500)
    }
  } finally {
    mailer?.close()
    await database.$disconnect()
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
  }
}

run().catch(() => {
  console.error(JSON.stringify({ event: 'mail_worker_startup_failed' }))
  process.exitCode = 1
})
