import type { PrismaClient } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Config } from '../../config/env.js'
import { ApiError } from '../../middleware/errors.js'
import { currentSession, requireRole } from '../auth/session.js'
import { fromProductSlug, parseQuery } from '../business-inputs.js'
import { clientList, clientWhere } from '../clients/routes.js'
import { contractList, contractWhere } from '../contracts/routes.js'
import { coverageStatus, dateOnly } from '../contracts/model.js'
import { partnerList, partnerWhere } from '../partners/routes.js'
import { quoteRequestList, quoteRequestWhere } from '../quote-requests/admin.js'
import { effectiveStatus } from '../quotes/model.js'
import { issuedQuoteList, issuedQuoteWhere } from '../quotes/routes.js'
import { staffAudit } from '../staff-records.js'
import { download, limitSpreadsheet, outputFormat } from './routes.js'
import { writeSpreadsheet } from './spreadsheets.js'

const exportKind = z.enum(['CLIENTS', 'PARTNERS', 'CONTRACTS', 'QUOTE_REQUESTS', 'ISSUED_QUOTES'])
type Kind = z.infer<typeof exportKind>
const exportLimit = 2000
const orderBy = [{ createdAt: 'desc' }, { id: 'desc' }] as const
const take = exportLimit + 1

async function filteredRows(db: PrismaClient, kind: Kind, filters: Record<string, unknown>): Promise<{ headers: string[]; rows: string[][] }> {
  if ('page' in filters || 'limit' in filters) throw new ApiError(400, 'EXPORT_FILTER', 'Retirez la pagination de la demande d’export.')
  const order = [...orderBy]
  switch (kind) {
    case 'CLIENTS': {
      const rows = await db.client.findMany({ take, orderBy: order, where: clientWhere(parseQuery(clientList, filters)),
        select: { id: true, legacyReference: true, displayName: true, profile: true, phone: true, email: true, city: true,
          archivedAt: true, intakeProvisional: true },
      })
      return {
        headers: ['Identifiant client', 'Référence historique', 'Nom complet', 'Profil', 'Téléphone', 'Email', 'Ville', 'État'],
        rows: rows.map(row => [row.id, row.legacyReference ?? '', row.displayName, row.profile === 'INDIVIDUAL' ? 'Particulier' : 'Entreprise',
          row.phone, row.email ?? '', row.city ?? '', row.archivedAt ? 'Archivé' : row.intakeProvisional ? 'Provisoire' : 'Vérifié']),
      }
    }
    case 'PARTNERS': {
      const rows = await db.partner.findMany({ take, orderBy: order, where: partnerWhere(parseQuery(partnerList, filters)),
        select: { id: true, legacyReference: true, name: true, displayName: true, website: true, categories: true, isActive: true, isPublished: true, verifiedAt: true },
      })
      return {
        headers: ['Identifiant compagnie', 'Référence historique', 'Raison sociale', 'Nom d’affichage', 'Site web', 'Catégories', 'Vérifiée', 'Active', 'Publiée'],
        rows: rows.map(row => [row.id, row.legacyReference ?? '', row.name, row.displayName ?? '', row.website ?? '', row.categories.map(fromProductSlug).join(' | '),
          row.verifiedAt ? 'Oui' : 'Non', row.isActive ? 'Oui' : 'Non', row.isPublished ? 'Oui' : 'Non']),
      }
    }
    case 'CONTRACTS': {
      const rows = await db.contract.findMany({ take, orderBy: order, where: contractWhere(parseQuery(contractList, filters)),
        select: { reference: true, legacyReference: true, policyNumber: true, clientId: true, partnerId: true,
          product: { select: { slug: true } }, status: true, effectiveOn: true, expiresOn: true, premiumMad: true, confirmationOn: true },
      })
      return {
        headers: ['Référence contrat', 'Référence historique', 'Numéro de police', 'Référence client', 'Référence compagnie', 'Catégorie',
          'Date d’effet', 'Date d’échéance', 'Prime MAD', 'État'],
        rows: rows.map(row => [row.reference, row.legacyReference ?? '', row.policyNumber ?? '', row.clientId, row.partnerId,
          fromProductSlug(row.product.slug), dateOnly(row.effectiveOn), dateOnly(row.expiresOn), row.premiumMad?.toFixed(2) ?? '', coverageStatus(row)]),
      }
    }
    case 'QUOTE_REQUESTS': {
      const rows = await db.quoteRequest.findMany({ take, orderBy: order, where: await quoteRequestWhere(db, parseQuery(quoteRequestList, filters)),
        select: { reference: true, status: true, createdAt: true, product: { select: { slug: true } } },
      })
      return {
        headers: ['Référence demande', 'Catégorie', 'État', 'Date de réception (UTC)'],
        rows: rows.map(row => [row.reference, fromProductSlug(row.product.slug), row.status, row.createdAt.toISOString()]),
      }
    }
    case 'ISSUED_QUOTES': {
      const where = await issuedQuoteWhere(db, parseQuery(issuedQuoteList, filters))
      const rows = await db.quote.findMany({ take, orderBy: order, where: { AND: [where, { issuedAt: { not: null }, status: { not: 'DRAFT' } }] },
        select: { reference: true, status: true, issuedAt: true, validUntil: true, revision: true, totalMad: true, product: { select: { slug: true } } },
      })
      return {
        headers: ['Référence devis', 'Révision', 'Catégorie', 'État', 'Émis le (UTC)', 'Valable jusqu’au', 'Total MAD'],
        rows: rows.map(row => [row.reference, String(row.revision), fromProductSlug(row.product.slug), effectiveStatus(row.status, row.validUntil),
          row.issuedAt?.toISOString() ?? '', row.validUntil ? dateOnly(row.validUntil) : '', row.totalMad?.toFixed(2) ?? '']),
      }
    }
  }
}

export function exportRoutes(db: PrismaClient, config: Config) {
  const routes = Router()
  routes.get('/:type', requireRole('ADMIN'), limitSpreadsheet(db, config, 'spreadsheet-export', 30), async (request, response) => {
    const kind = parseQuery(exportKind, request.params.type)
    const { format: selected, ...filters } = request.query
    const format = parseQuery(outputFormat.default('xlsx'), selected)
    const { headers, rows } = await filteredRows(db, kind, filters)
    if (rows.length > exportLimit) throw new ApiError(422, 'EXPORT_LIMIT', 'Affinez les filtres pour exporter au plus 2 000 dossiers.')
    const timestamp = new Date().toISOString()
    const bytes = await writeSpreadsheet(format, [...headers, 'Exporté le (UTC)'], rows.map(row => [...row, timestamp]), 'Export')
    await staffAudit(db, response, 'export', currentSession(response).user.id, 'SPREADSHEET_EXPORTED', { count: rows.length, kind, format })
    response.set('X-Exported-At', timestamp)
    download(response, format, 'export-' + kind.toLowerCase() + '-' + timestamp.slice(0, 19).replace(/[:T]/g, '-'), bytes)
  })
  return routes
}
