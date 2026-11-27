import { setTimeout as delay } from 'node:timers/promises'
import { loadConfig } from './config/env.js'
import { connectPrisma } from './database/prisma.js'
import { deliverNextQuote, generateNextQuotePdf, maintainQuoteJobs } from './modules/quotes/jobs.js'
import { deliverNextRenewal, maintainContracts } from './modules/contracts/reminders.js'
import { expireImports } from './modules/imports/routes.js'
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
          await maintainQuoteJobs(database)
          await maintainContracts(database)
          await expireImports(database)
          nextCleanup = Date.now() + 60_000
        }
        const mail = mailer && !stopping && await deliverNextMail(database, config, mailer)
        const pdf = !stopping && await generateNextQuotePdf(database, config)
        const quote = mailer && !stopping && await deliverNextQuote(database, config, mailer)
        const renewal = mailer && !stopping && await deliverNextRenewal(database, config, mailer)
        if (mail || pdf || quote || renewal) continue
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
