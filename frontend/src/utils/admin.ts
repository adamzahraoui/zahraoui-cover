import { getInsurance } from '../data/insurance'
import type { ProductSlug } from '../config/navigation'
import type { DemoClient } from '../data/demo'

export const statuses = {
  NEW: { label: 'Nouvelle', tone: 'info' },
  IN_REVIEW: { label: 'En cours d’étude', tone: 'warning' },
  QUOTE_SENT: { label: 'Devis envoyé', tone: 'info' },
  ACCEPTED: { label: 'Accepté', tone: 'success' },
  DECLINED: { label: 'Refusé', tone: 'danger' },
  CLOSED: { label: 'Clôturée', tone: 'neutral' },
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  ISSUED: { label: 'Émis', tone: 'info' },
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

export function clientName(clients: DemoClient[], id: string) {
  return clients.find(client => client.id === id)?.displayName ?? 'Client indisponible'
}

export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export function moneyLabel(value: string) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(Number(value))
}

export function demoId(prefix: string) {
  const id = crypto.randomUUID()
  return { id, reference: `${prefix}-DÉMO-${id.slice(0, 8).toUpperCase()}` }
}
