const assert = require('node:assert/strict')
const { randomUUID, randomBytes, randomInt } = require('node:crypto')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const { resolve } = require('node:path')
const { chromium } = require('playwright')
const origin = process.env.PUBLIC_ORIGIN
const root = resolve(__dirname, '..')
const mailpit = process.env.MAILPIT_ORIGIN ?? 'http://127.0.0.1:8025'
const widths = [390, 768, 1024, 1440]
const products = ['automobile', 'habitation', 'sante', 'voyage', 'professionnelle', 'responsabilite-civile']
const publicPaths = [
  '/',
  '/assurances',
  ...products.map((slug) => '/assurances/' + slug),
  '/devis',
  '/particuliers',
  '/professionnels',
  '/a-propos',
  '/contact',
  '/assistance',
  '/faq',
  '/mentions-legales',
  '/politique-de-confidentialite',
  '/politique-de-cookies',
  '/introuvable-b14',
]
const authPaths = ['/admin/login', '/admin/mot-de-passe-oublie', '/admin/reinitialiser-mot-de-passe']
const results = []
const processes = []
const errors = []
let db, browser, stage
const button = (p, name) => p.getByRole('button', { name, exact: true })
const element = (p, name) => p.locator('main [name="' + name + '"]')
const fill = async (p, input) => {
  for (const [key, value] of Object.entries(input)) await element(p, key).fill(value)
}
async function poll(fn) {
  for (let i = 0; i < 80; i++) {
    const value = await fn()
    if (value) return value
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Operation did not become ready')
}
async function fit(p, path) {
  await p.locator('main h1').first().waitFor()
  await p.evaluate(() => document.fonts.ready)
  const [width, viewport] = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth])
  if (width > viewport) console.error('Page width', width, 'viewport', viewport, 'route', path)
  assert(width <= viewport, path + ' overflow ' + width + '/' + viewport)
}
function start(entry) {
  const child = spawn(process.execPath, ['dist/src/' + entry + '.js'], {
    cwd: resolve(root, 'backend'),
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  processes.push(child)
}
async function receipt(page, path, submit) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/' + path && response.request().method() === 'POST',
    ),
    button(page, submit).click(),
  ])
  assert(response.ok(), path + ' returned ' + response.status())
  const reference = (await response.json()).data.reference
  await page.getByText(reference, { exact: true }).waitFor()
  return reference
}
async function main() {
  assert.equal(process.env.NODE_ENV, 'test')
  const databaseUrl = new URL(process.env.DATABASE_URL)
  assert(
    ['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) && databaseUrl.pathname.endsWith('_test'),
    'Browser tests require a disposable loopback test database',
  )
  for (const url of [origin, mailpit]) assert.equal(new URL(url).hostname, '127.0.0.1')
  assert.equal(process.env.SMTP_MODE, 'local')
  assert.equal(process.env.SMTP_HOST, '127.0.0.1')
  assert.equal(process.env.PUBLIC_INDEXING_ENABLED ?? 'false', 'false')
  const { connectPrisma } = await import(resolve(root, 'backend/dist/src/database/prisma.js'))
  const { hashPassword } = await import(resolve(root, 'backend/dist/src/utils/crypto.js'))
  const { casablancaDate } = await import(resolve(root, 'backend/dist/src/modules/business-inputs.js'))
  const { addDays } = await import(resolve(root, 'backend/dist/src/modules/contracts/model.js'))
  db = connectPrisma(process.env.DATABASE_URL)
  const email = randomUUID() + '@example.invalid',
    password = randomBytes(20).toString('base64url')
  const administrator = await db.staffUser.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      displayName: 'Administrateur matrice',
    },
  })
  await db.insuranceProduct.updateMany({ data: { isPublished: true } })
  start('server')
  start('worker')
  await poll(async () => {
    try {
      return (await fetch(origin + '/api/health/ready')).ok
    } catch {
      return false
    }
  })
  browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE })
  for (const width of widths) {
    stage = width
    const contexts = await Promise.all(
      [0, 1].map(() => browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })),
    )
    const [visitor, admin] = await Promise.all(contexts.map((context) => context.newPage()))
    for (const page of [visitor, admin]) {
      page.setDefaultTimeout(8000)
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (/violates the following Content Security Policy/i.test(message.text()))
          errors.push('CSP violation: ' + message.text())
      })
    }
    for (const path of publicPaths) {
      stage = width + ' ' + path
      const response = await visitor.goto(origin + path)
      assert.equal(response.status(), path === '/introuvable-b14' ? 404 : 200)
      await fit(visitor, path)
    }
    stage = width + ' keyboard/navigation'
    await visitor.goto(origin + '/')
    await fit(visitor, 'home navigation')
    await visitor.keyboard.press('Tab')
    assert(
      await visitor
        .getByRole('link', { name: 'Aller au contenu' })
        .evaluate((e) => e === document.activeElement),
    )
    await visitor.keyboard.press('Enter')
    assert.equal(await visitor.evaluate(() => location.hash), '#contenu')
    assert(await visitor.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
    const links = await visitor.getByRole('link', { name: 'Nos assurances', exact: true }).all()
    const visible = await Promise.all(links.map((link) => link.isVisible()))
    if (visible.includes(true)) {
      await links[visible.indexOf(true)].click()
      await visitor.waitForURL('**/assurances')
    }
    for (const path of authPaths) {
      stage = width + ' ' + path
      await visitor.goto(origin + path)
      const authHeading = visitor.locator('h1').first()
      await authHeading.waitFor()
      assert(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    await visitor.goto(origin + '/admin/clients')
    await visitor.waitForURL('**/admin/login')
    const token = randomUUID().slice(0, 8)
    const contactEmail = 'audit-' + token + '@example.invalid'
    const phone = '+212610' + String(randomInt(100000, 1000000))
    stage = width + ' quote workflow'
    await visitor.goto(origin + '/devis')
    await visitor.getByRole('radio', { name: 'Particulier' }).check()
    await element(visitor, 'product').selectOption('automobile')
    await button(visitor, 'Continuer').click()
    await element(visitor, 'needs').fill('Besoin synthétique pour la matrice de navigation.')
    await button(visitor, 'Continuer').click()
    await fill(visitor, {
      lastName: 'Audit',
      firstName: 'Navigateur',
      phone,
      email: contactEmail,
      city: 'Casablanca',
    })
    await button(visitor, 'Vérifier ma demande').click()
    await element(visitor, 'acknowledged').check()
    const requestRef = await receipt(visitor, 'quotes', 'Envoyer ma demande')
    await fit(visitor, 'quote receipt')
    const intake = await db.quoteRequest.findUniqueOrThrow({ where: { reference: requestRef } })
    stage = width + ' contact / assistance workflow'
    await visitor.goto(origin + '/contact')
    await fill(visitor, {
      fullName: 'Navigateur Audit',
      phone,
      email: contactEmail,
      subject: 'Message de test',
      message: 'Message synthétique pour la vérification locale.',
    })
    await element(visitor, 'acknowledged').check()
    const contactRef = await receipt(visitor, 'contact', 'Envoyer le message')
    await db.contactMessage.findUniqueOrThrow({ where: { reference: contactRef } })
    await visitor.goto(origin + '/assistance')
    await fill(visitor, {
      fullName: 'Navigateur Audit',
      phone,
      description: 'Assistance synthétique pour la vérification locale.',
    })
    await element(visitor, 'productSlug').selectOption('automobile')
    await element(visitor, 'acknowledged').check()
    const assistanceRef = await receipt(visitor, 'assistance', 'Envoyer la demande')
    await db.assistanceCase.findUniqueOrThrow({ where: { reference: assistanceRef } })
    stage = width + ' login / session'
    await admin.goto(origin + '/admin/login')
    await admin.getByLabel('Adresse email professionnelle').fill(email)
    await element(admin, 'password').fill(password)
    await button(admin, 'Se connecter').click()
    await admin.waitForURL('**/admin/dashboard')
    await fit(admin, 'dashboard')
    const mobileMenu = button(admin, 'Ouvrir le menu d’administration')
    if (await mobileMenu.isVisible()) {
      await mobileMenu.focus()
      await admin.keyboard.press('Enter')
      await admin.getByRole('navigation', { name: 'Administration' }).waitFor()
      await admin.keyboard.press('Escape')
      assert(await mobileMenu.evaluate((e) => e === document.activeElement))
    }
    const request = contexts[1].request
    const session = (await (await request.get(origin + '/api/auth/session')).json()).data
    const headers = { Origin: origin, 'X-CSRF-Token': session.csrfToken }
    const api = async (method, path, data, expected = 200) => {
      const r = await request.fetch(origin + '/api' + path, { method, headers, data })
      if (r.status() !== expected) {
        const result = await r.json()
        throw new Error(
          path +
            ' returned ' +
            r.status() +
            ', expected ' +
            expected +
            ' ' +
            JSON.stringify(result.error ?? {}),
        )
      }
      return (await r.json()).data
    }
    stage = width + ' CRM/partner/issued quote'
    const client = await api(
      'POST',
      '/admin/clients',
      {
        profile: 'INDIVIDUAL',
        displayName: 'Client de vérification ' + token,
        phone: phone.replace('+212610', '+212611'),
        email: 'issued-' + contactEmail,
      },
      201,
    )
    const partner = await api(
      'POST',
      '/admin/partners',
      { name: 'Assureur matrice ' + token, categories: ['automobile'] },
      201,
    )
    const reviewed = await api('POST', '/admin/partners/' + partner.id + '/verify', {
      version: partner.version,
      reference: 'Revue de test',
    })
    await api('PATCH', '/admin/partners/' + partner.id, {
      version: reviewed.version,
      isActive: true,
      isPublished: true,
    })
    assert((await api('GET', '/partners')).some((row) => row.name === 'Assureur matrice ' + token))
    const today = casablancaDate(),
      expiresOn = addDays(today, 90)
    const quote = await api(
      'POST',
      '/admin/quotes',
      {
        clientId: client.id,
        partnerId: partner.id,
        productSlug: 'automobile',
        annualPremiumMad: '1250.00',
        validUntil: addDays(today, 30),
        coverage: 'Garanties de développement',
        coverageLimits: 'Limites de développement',
        conditions: 'Conditions de développement',
      },
      201,
    )
    await api('POST', '/admin/quotes/' + quote.id + '/issue', { version: quote.version }, 202)
    const quotePath = '/admin/quotes/' + quote.id
    const issued = await poll(async () => {
      const row = await api('GET', quotePath)
      return row.documents[0]?.status === 'READY' && row
    })
    const pdf = await request.get(origin + '/api/admin/documents/' + issued.documents[0].id + '/download')
    assert(pdf.ok())
    assert.equal((await pdf.body()).subarray(0, 5).toString(), '%PDF-')
    await api('POST', quotePath + '/send', { version: issued.version }, 202)
    const sent = await poll(async () => {
      const row = await api('GET', quotePath)
      return row.status === 'SENT' && row
    })
    const messages = await (await fetch(mailpit + '/api/v1/messages')).json()
    assert(
      messages.messages.some(
        (message) =>
          message.To.some((to) => to.Address === 'issued-' + contactEmail) && message.Attachments > 0,
      ),
    )
    const accepted = await api('POST', quotePath + '/decision', {
      version: sent.version,
      status: 'ACCEPTED',
      method: 'PHONE',
      evidence: 'Décision téléphonique synthétique.',
    })
    stage = width + ' contract / renewal'
    const contract = await api(
      'POST',
      '/admin/contracts',
      {
        quoteId: quote.id,
        quoteVersion: accepted.version,
        effectiveOn: today,
        expiresOn,
        policyNumber: 'B14-' + token,
        coverage: 'Garanties de test',
        premiumMad: '1250.00',
      },
      201,
    )
    const active = await api(
      'POST',
      '/admin/contracts/' + contract.id + '/status',
      {
        version: contract.version,
        status: 'ACTIVE',
        confirmationReference: 'POL-' + token,
        confirmationOn: today,
      },
      202,
    )
    await api(
      'POST',
      '/admin/contracts/' + contract.id + '/renew',
      { version: active.version, effectiveOn: expiresOn, expiresOn: addDays(expiresOn, 90) },
      201,
    )
    const staffPaths = [
      '/admin',
      '/admin/dashboard',
      '/admin/demandes',
      '/admin/demandes/' + intake.id,
      '/admin/clients',
      '/admin/clients/nouveau',
      '/admin/clients/' + client.id,
      '/admin/clients/' + client.id + '/modifier',
      '/admin/devis',
      '/admin/devis/nouveau',
      '/admin/devis/' + quote.id,
      '/admin/contrats',
      '/admin/contrats/nouveau',
      '/admin/contrats/' + contract.id,
      '/admin/documents',
      '/admin/assistance',
      '/admin/assurances',
      '/admin/partenaires',
      '/admin/messages',
      '/admin/import-export',
      '/admin/parametres',
      '/admin/introuvable-b14',
    ]
    for (const path of staffPaths) {
      stage = width + ' ' + path
      assert.equal((await admin.goto(origin + path)).status(), 200)
      await fit(admin, path)
      assert(!admin.url().endsWith('/login'))
    }
    stage = width + ' import/export'
    await admin.goto(origin + '/admin/import-export')
    await element(admin, 'file').setInputFiles({
      name: 'b14-audit.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'Profil,Nom complet,Téléphone,Email\nParticulier,Import Audit ' +
          token +
          ',' +
          phone.replace('+212610', '+212612') +
          ',import-' +
          contactEmail +
          '\n',
      ),
    })
    await button(admin, 'Lire le fichier').click()
    await button(admin, 'Valider et prévisualiser').click()
    await admin.getByRole('checkbox', { name: /Je confirme la création/ }).check()
    await button(admin, 'Confirmer l’import').click()
    await admin.getByText('Import enregistré.', { exact: true }).waitFor()
    assert(await db.client.findFirst({ where: { email: 'import-' + contactEmail } }))
    await button(admin, 'Exporter des données').click()
    await element(admin, 'format').selectOption('csv')
    const [download] = await Promise.all([
      admin.waitForEvent('download'),
      button(admin, 'Télécharger l’export').click(),
    ])
    assert((await fs.readFile(await download.path(), 'utf8')).includes('Import Audit ' + token))
    await button(admin, 'Historique des importations').click()
    await admin.reload()
    await admin.getByRole('heading', { name: 'Historique des importations', exact: true }).waitFor()
    stage = width + ' accessibility'
    const axe = await fs.readFile(require.resolve('axe-core/axe.min.js'), 'utf8')
    const accessibility = []
    if (width === 390 || width === 1440)
      for (const route of ['/admin/dashboard', '/admin/clients', '/admin/parametres']) {
        await admin.goto(origin + route)
        await fit(admin, route)
        await admin.evaluate(axe)
        const report = await admin.evaluate(() =>
          axe.run({
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
          }),
        )
        accessibility.push({
          route,
          violations: report.violations.map((v) => ({
            id: v.id,
            count: v.nodes.length,
            targets: v.nodes.map((n) => n.target),
          })),
        })
      }
    stage = width + ' expired session'
    await db.adminSession.updateMany({
      where: { staffId: administrator.id, revokedAt: null },
      data: { lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    })
    await admin.goto(origin + '/admin/clients')
    await admin.waitForURL('**/admin/login')
    assert.deepEqual(errors, [])
    results.push({
      width,
      publicPaths: publicPaths.length,
      authPaths: authPaths.length,
      staffPaths: staffPaths.length,
      accessibility,
    })
    console.log(
      width +
        'px completed ' +
        (publicPaths.length + authPaths.length + staffPaths.length) +
        ' routes, public submissions, CRM, partner, quote delivery, contract/renewal and import/export',
    )
    await Promise.all(contexts.map((context) => context.close()))
  }
  console.log(JSON.stringify(results, null, 2))
}
main()
  .catch((error) => {
    console.error('Stage:', stage, error)
    process.exitCode = 1
  })
  .finally(async () => {
    for (const child of processes) child.kill()
    await browser?.close()
    await db?.$disconnect()
  })
