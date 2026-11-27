import type { ActivityEntry } from '../../types/api'

export const activityNames: Record<string, string> = {
  QUOTE_REQUEST_RECEIVED: 'Demande de devis reçue',
  QUOTE_REQUEST_UPDATED: 'Demande de devis mise à jour',
  QUOTE_REQUEST_NOTE_ADDED: 'Note de devis ajoutée',
  CLIENT_CREATED: 'Fiche client créée',
  CLIENT_UPDATED: 'Fiche client mise à jour',
  CLIENT_VERIFIED: 'Client vérifié',
  CLIENT_ARCHIVED: 'Fiche client archivée',
  CONTACT_RECEIVED: 'Message reçu',
  CONTACT_UPDATED: 'Message mis à jour',
  CONTACT_ARCHIVED: 'Message archivé',
  ASSISTANCE_RECEIVED: 'Demande d’assistance reçue',
  ASSISTANCE_UPDATED: 'Demande d’assistance mise à jour',
  ASSISTANCE_NOTE_ADDED: 'Note d’assistance ajoutée',
}

export function activityDate(value: string) {
  return new Date(value).toLocaleString('fr-MA', { timeZone: 'Africa/Casablanca', dateStyle: 'medium', timeStyle: 'short' })
}

export function ActivityList({ activity }: { activity: ActivityEntry[] }) {
  if (!activity.length) return <p className="text-sm text-muted">Aucune activité enregistrée.</p>
  return <ul className="grid gap-2 text-sm">{activity.map(entry => (
    <li className="flex flex-wrap justify-between gap-2" key={entry.id}>
      <span>{activityNames[entry.action] ?? 'Dossier mis à jour'}{entry.actor ? ` · ${entry.actor.displayName}` : ''}</span>
      <time dateTime={entry.createdAt} className="text-muted">{activityDate(entry.createdAt)}</time>
    </li>
  ))}</ul>
}
