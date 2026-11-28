import type { PrismaClient } from '@prisma/client'
import { Router, static as files } from 'express'
import type { Request } from 'express'
import helmet from 'helmet'
import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { Config } from '../../config/env.js'
import { official, published } from '../agency/model.js'
import { fromProductSlug, productSlug, toProductSlug } from '../business-inputs.js'

type Metadata = { title: string; description: string }

const pages = new Map<string, Metadata>([
  ['/', { title: 'Courtage en assurances', description: 'Découvrez le courtage en assurances pour particuliers et professionnels au Maroc.' }],
  ['/assurances', { title: 'Nos assurances', description: 'Explorez les catégories d’assurance proposées par le cabinet de courtage.' }],
  ['/particuliers', { title: 'Assurances pour les particuliers', description: 'Découvrez les catégories de couverture pour vos besoins personnels.' }],
  ['/professionnels', { title: 'Assurances pour les professionnels', description: 'Découvrez les catégories de couverture pour votre activité professionnelle.' }],
  ['/a-propos', { title: 'À propos', description: 'Découvrez le rôle de Zahraoui Cover et les services du cabinet de courtage.' }],
  ['/contact', { title: 'Contact', description: 'Retrouvez les coordonnées officielles et le formulaire pour joindre le cabinet.' }],
  ['/assistance', { title: 'Assistance', description: 'Retrouvez les coordonnées du service d’assistance et le formulaire de demande.' }],
  ['/faq', { title: 'Questions fréquentes', description: 'Consultez les réponses aux questions fréquentes sur le courtage et les demandes de devis.' }],
  ['/mentions-legales', { title: 'Mentions légales', description: 'Consultez les informations légales publiées par le cabinet.' }],
  ['/politique-de-confidentialite', { title: 'Politique de confidentialité', description: 'Consultez les informations sur le traitement des données.' }],
  ['/politique-de-cookies', { title: 'Politique de cookies', description: 'Consultez la politique de cookies du site.' }],
  ['/devis', { title: 'Demande de devis', description: 'Envoyez au cabinet une demande de devis pour une catégorie d’assurance.' }],
])
const missing: Metadata = { title: 'Page introuvable', description: 'Cette page est introuvable.' }
const admin: Metadata = { title: 'Espace Administration', description: 'Espace réservé au personnel autorisé.' }
const fallbackRobots = 'User-agent: *\nDisallow: /\n'

function escaped(value: string) {
  return value.replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function renderHead(index: string, metadata: Metadata, canonical?: string) {
  const title = escaped(metadata.title + ' | ' + official.agencyName)
  const description = escaped(metadata.description)
  return index
    .replace(/<title>[^<]*<\/title>/, () => '<title>' + title + '</title>')
    .replace(/<meta name="description"[^>]*>/, () => '<meta name="description" content="' + description + '" />')
    .replace(/<meta name="robots"[^>]*>/, () => canonical
      ? '<meta name="robots" content="index, follow" />\n' +
        '<link rel="canonical" href="' + escaped(canonical) + '" />\n' +
        '<meta property="og:type" content="website" />\n' +
        '<meta property="og:url" content="' + escaped(canonical) + '" />\n' +
        '<meta property="og:title" content="' + title + '" />\n' +
        '<meta property="og:description" content="' + description + '" />\n' +
        '<meta name="twitter:card" content="summary" />\n' +
        '<meta name="twitter:title" content="' + title + '" />\n' +
        '<meta name="twitter:description" content="' + description + '" />'
      : '<meta name="robots" content="noindex, nofollow" />')
}

export function permissionsPolicy() {
  return 'camera=(), microphone=(), geolocation=(), payment=()'
}

export async function webPages(db: PrismaClient, config: Config) {
  const routes = Router()
  const directory = config.FRONTEND_DIST_DIR
  if (!directory || !isAbsolute(directory)) throw new Error('FRONTEND_DIST_DIR must be an absolute build directory')
  const index = await readFile(join(directory, 'index.html'), 'utf8')
  if (!index.includes('noindex, nofollow') || !index.includes('<div id="root">')) throw new Error('Expected the Zahraoui Cover frontend build')
  const mayIndex = async () => {
    if (!config.PUBLIC_INDEXING_ENABLED || config.NODE_ENV !== 'production' || !config.PUBLIC_ORIGIN.startsWith('https://')) return false
    const [agency, legal, privacy, cookies, quote, products] = await Promise.all([
      db.agencySettings.findUnique({where:{id:1},select:{publicApprovedAt:true}}), published(db,'LEGAL'), published(db,'PRIVACY'), published(db,'COOKIES'), published(db,'QUOTE'),
      db.insuranceProduct.count({where:{isActive:true,isPublished:true}}),
    ])
    return Boolean(agency?.publicApprovedAt && legal && privacy && cookies && quote && products)
  }
  const canonical = (pathname: string) => new URL(pathname, config.PUBLIC_ORIGIN).href

  routes.get('/robots.txt', async (_request, response) => {
    response.set('Cache-Control', 'no-cache')
    response.type('text/plain').send(await mayIndex()
      ? 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nSitemap: ' + canonical('/sitemap.xml') + '\n'
      : fallbackRobots)
  })
  routes.get('/sitemap.xml', async (_request, response) => {
    response.set('Cache-Control', 'no-cache')
    if (!await mayIndex()) { response.status(404).type('text/plain').send('Sitemap indisponible.'); return }
    const products = await db.insuranceProduct.findMany({where:{isActive:true,isPublished:true},select:{slug:true},orderBy:{slug:'asc'}})
    const locations = [...pages.keys(), ...products.map(product => '/assurances/' + fromProductSlug(product.slug))]
    response.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      locations.map(path => '<url><loc>' + escaped(canonical(path)) + '</loc></url>').join('') + '</urlset>')
  })

  routes.use('/assets', files(join(directory,'assets'), { index: false, redirect: false, immutable: true, maxAge: '1y', dotfiles: 'deny' }),
    (_request, response) => response.status(404).type('text/plain').send('Fichier introuvable.'))
  const pageCsp = helmet.contentSecurityPolicy({ useDefaults: false, directives: {
    defaultSrc: ["'none'"], scriptSrc: ["'self'"], connectSrc: ["'self'"], styleSrc: ["'self'"],
    styleSrcAttr: ["'unsafe-inline'"], imgSrc: ["'self'"], fontSrc: ["'self'"], baseUri: ["'none'"],
    frameAncestors: ["'none'"], formAction: ["'self'"],
  } })
  routes.get(/^(?!\/api(?:\/|$))/i, pageCsp, async (request: Request, response) => {
    const path = request.path.replace(/\/+$/, '') || '/'
    // Missing static assets retain an ordinary 404 and never receive the SPA.
    if (/\.[^/]+$/.test(path)) { response.status(404).type('text/plain').send('Fichier introuvable.'); return }
    const protectedPage = /^\/admin(?:\/|$)/i.test(path)
    const slug = productSlug.safeParse(path.slice('/assurances/'.length))
    let metadata = protectedPage ? admin : pages.get(path)
    if (!metadata && path.startsWith('/assurances/') && slug.success) {
      const product = await db.insuranceProduct.findFirst({ where: { slug: toProductSlug(slug.data), isPublished: true, isActive: true },
        select: { title: true, summary: true },
      })
      if (product) metadata = { title: product.title, description: product.summary }
    }
    const indexed = !protectedPage && Boolean(metadata) && await mayIndex()
    if (!indexed) response.set('X-Robots-Tag','noindex, nofollow')
    response.set('Cache-Control', protectedPage ? 'no-store' : 'no-cache')
    response.status(metadata ? 200 : 404).type('html').send(renderHead(index, metadata ?? missing, indexed ? canonical(path) : undefined))
  })
  return routes
}
