import { getInsurance } from '../data/insurance'
import type { ProductSlug } from '../config/navigation'

export const statuses = {
  NEW: { label: 'Nouvelle', tone: 'info' },
  IN_REVIEW: { label: 'En cours d’étude', tone: 'warning' },
  QUOTE_SENT: { label: 'Devis envoyé', tone: 'info' },
  ACCEPTED: { label: 'Accepté', tone: 'success' },
  DECLINED: { label: 'Refusé', tone: 'danger' },
  CLOSED: { label: 'Clôturée', tone: 'neutral' },
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  ISSUED: { label: 'Émis', tone: 'info' },
  SENT: { label: 'Envoyé', tone: 'success' },
  SCHEDULED: { label: 'Effet futur', tone: 'info' },
  UNVERIFIED: { label: 'Confirmation manquante', tone: 'warning' },
  ACTIVE: { label: 'Actif', tone: 'success' },
  EXPIRED: { label: 'Expiré', tone: 'warning' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
  IN_PROGRESS: { label: 'En cours', tone: 'warning' },
  RESOLVED: { label: 'Résolue', tone: 'success' },
  UNREAD: { label: 'Non lu', tone: 'info' },
  READ: { label: 'Lu', tone: 'neutral' },
  PROCESSED: { label: 'Traité', tone: 'success' },
} as const

export const profiles = [
  { value: 'INDIVIDUAL', label: 'Particulier' },
  { value: 'BUSINESS', label: 'Professionnel / Entreprise' },
]

export function statusOptions(keys: readonly (keyof typeof statuses)[]) {
  return keys.map(value => ({ value, label: statuses[value].label }))
}

export function productName(slug: ProductSlug) {
  return getInsurance(slug).label
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
