import { ImportKind } from '@prisma/client'
import { z } from 'zod'
import { ApiError } from '../../middleware/errors.js'
import { fold, maxColumns, maxSheets } from './spreadsheets.js'

type Field = { key: string; label: string; required?: boolean; aliases?: string[] }
const legacy: Field = { key: 'legacyReference', label: 'Référence historique', aliases: ['ID historique', 'Ancien identifiant', 'Code historique'] }
const phone: Field = { key: 'phone', label: 'Téléphone', aliases: ['Tel', 'Portable', 'Mobile'] }
const email: Field = { key: 'email', label: 'Email', aliases: ['Courriel', 'E-mail'] }

export const fields: Record<ImportKind, Field[]> = {
  CLIENTS: [
    { key: 'profile', label: 'Profil', required: true, aliases: ['Type de client'] },
    { key: 'displayName', label: 'Nom complet', aliases: ['Nom du client', 'Nom et prénom'] },
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom de famille', aliases: ['Nom'] },
    { key: 'company', label: 'Raison sociale', aliases: ['Société', 'Entreprise'] },
    { ...phone, required: true }, email, { key: 'city', label: 'Ville', aliases: ['Commune'] }, legacy,
  ],
  PARTNERS: [
    { key: 'name', label: 'Raison sociale', required: true, aliases: ['Compagnie', 'Assureur', 'Nom légal'] },
    { key: 'displayName', label: 'Nom d’affichage' }, { key: 'contactPerson', label: 'Contact' }, phone, email,
    { key: 'website', label: 'Site web', aliases: ['URL', 'Site Internet'] }, { key: 'address', label: 'Adresse' },
    { key: 'categories', label: 'Catégories', aliases: ['Branches', 'Produits'] }, legacy,
  ],
  CONTRACTS: [
    { key: 'policyNumber', label: 'Numéro de police', required: true, aliases: ['Référence assureur', 'Police'] }, legacy,
    { key: 'customer', label: 'Référence client', required: true, aliases: ['ID client', 'Code client'] },
    { key: 'partner', label: 'Référence compagnie', required: true, aliases: ['ID partenaire', 'Code assureur'] },
    { key: 'category', label: 'Catégorie', required: true, aliases: ['Branche', 'Produit'] },
    { key: 'effectiveOn', label: 'Date d’effet', required: true, aliases: ['Date début', 'Date de début'] },
    { key: 'expiresOn', label: 'Date d’échéance', required: true, aliases: ['Date fin', 'Date de fin'] },
    { key: 'premiumMad', label: 'Prime MAD', aliases: ['Prime', 'Montant MAD'] },
    { key: 'coverage', label: 'Garanties', aliases: ['Couverture'] },
  ],
}

export const selectionSchema = z.strictObject({
  sheet: z.number().int().min(0).max(maxSheets - 1),
  mapping: z.array(z.string().max(32).nullable()).min(1).max(maxColumns),
})
export type Selection = z.infer<typeof selectionSchema>

export function recommended(kind: ImportKind, headers: string[]) {
  const potential = headers.map(header => fields[kind].filter(field =>
    [field.label, ...(field.aliases ?? [])].some(alias => fold(alias) === fold(header))))
  return potential.map(matches => matches.length === 1 &&
    potential.filter(other => other.some(field => field.key === matches[0].key)).length === 1 ? matches[0].key : null)
}

export function checkMapping(kind: ImportKind, headers: string[], mapping: Selection['mapping']) {
  const values = mapping.filter(value => value !== null)
  const known = fields[kind]
  if (headers.length !== mapping.length || new Set(values).size !== values.length ||
      mapping.some((value, i) => value !== null && (!headers[i] || !known.some(field => field.key === value))) ||
      known.some(field => field.required && !values.includes(field.key)) ||
      (kind === 'CLIENTS' && !(values.includes('displayName') || values.includes('lastName') || values.includes('company')))) {
    throw new ApiError(422, 'IMPORT_MAPPING', 'Associez les champs obligatoires à des colonnes distinctes.')
  }
}
