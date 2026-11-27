import { createInterface } from 'node:readline/promises'
import { loadConfig } from '../../config/env.js'
import { connectPrisma } from '../../database/prisma.js'
import { audit } from './audit.js'
import { displayNameField, emailField } from './contracts.js'
import { queueReset } from './recovery.js'

async function run() {
  const config = loadConfig()
  if (config.SMTP_MODE === 'disabled') throw new Error('Mail is disabled')
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  let email, displayName
  try {
    email = emailField.safeParse(await prompt.question('Email professionnel : '))
    displayName = displayNameField.safeParse(await prompt.question('Nom affiché : '))
  } finally {
    prompt.close()
  }
  if (!email.success || !displayName.success) throw new Error('Invalid account details')

  const database = connectPrisma(config.DATABASE_URL)
  try {
    const created = await database.$transaction(async transaction => {
      // Serialize first-admin provisioning across concurrent operator invocations.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(381972, 1)`
      if (await transaction.staffUser.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })) return false
      const staff = await transaction.staffUser.create({
        data: { email: email.data, displayName: displayName.data, role: 'ADMIN' },
        select: { id: true },
      })
      await queueReset(transaction, config, staff.id, new Date())
      await audit(transaction, 'AUTH_ADMIN_PROVISIONED', undefined, staff.id)
      return true
    })
    if (!created) {
      console.error('Un administrateur existe déjà. Utilisez la procédure de récupération de compte.')
      process.exitCode = 1
    } else console.info('Administrateur créé. Le lien de configuration est en attente de traitement SMTP.')
  } finally {
    await database.$disconnect()
  }
}

run().catch(() => {
  console.error('Création impossible. Vérifiez la configuration, la base de données et les champs.')
  process.exitCode = 1
})
