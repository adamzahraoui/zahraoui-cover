import type { ActivityEntry } from '../../types/api'

export const activityNames: Record<string, string> = {
  RECORD_IMPORTED: 'Dossier créé par import',
  DOCUMENT_UPLOADED: 'PDF déposé',
  DOCUMENT_ARCHIVED: 'Document archivé',
  QUOTE_DOCUMENT_VIEWED: 'PDF de devis consulté',
  CONTRACT_DOCUMENT_VIEWED: 'PDF de contrat téléchargé',
  PARTNER_CREATED: 'Fiche partenaire créée',
  PARTNER_VERIFIED: 'Compagnie vérifiée',
  PARTNER_UPDATED: 'Fiche partenaire mise à jour',
  PARTNER_REVIEW_REQUIRED: 'Nouvelle vérification requise',
  CONTRACT_CREATED_FROM_QUOTE: 'Contrat préparé depuis un devis',
  CONTRACT_EXTERNAL_DRAFT_CREATED: 'Police externe enregistrée en brouillon',
  CONTRACT_UPDATED: 'Brouillon de contrat modifié',
  CONTRACT_CONFIRMED: 'Confirmation de l’assureur enregistrée',
  CONTRACT_CANCELLED: 'Fiche de contrat annulée',
  CONTRACT_EXPIRED: 'Contrat arrivé à échéance',
  CONTRACT_DOCUMENT_ATTACHED: 'Pièce de l’assureur ajoutée',
  CONTRACT_RENEWAL_PREPARED: 'Renouvellement préparé',
  CONTRACT_RENEWAL_CREATED: 'Brouillon de renouvellement créé',
  CONTRACT_REMINDER_DELIVERED: 'Rappel d’échéance accepté par SMTP',
  CONTRACT_REMINDER_FAILED: 'Échec du rappel d’échéance',
  QUOTE_CREATED: 'Brouillon de devis créé',
  QUOTE_UPDATED: 'Brouillon de devis modifié',
  QUOTE_ISSUED: 'Devis émis',
  QUOTE_PDF_READY: 'PDF de devis prêt',
  QUOTE_PDF_FAILED: 'Échec de génération du PDF',
  QUOTE_PDF_REQUEUED: 'PDF remis en file',
  QUOTE_DELIVERY_QUEUED: 'Envoi du devis mis en file',
  QUOTE_DELIVERED: 'Envoi du devis accepté par SMTP',
  QUOTE_DELIVERY_FAILED: 'Échec de l’envoi du devis',
  QUOTE_EXPIRED: 'Devis arrivé à échéance',
  QUOTE_CANCELLED: 'Devis annulé',
  QUOTE_REVISION_CREATED: 'Révision de devis créée',
  QUOTE_DECISION_RECORDED: 'Décision sur le devis enregistrée',
  QUOTE_REQUEST_DELIVERED: 'Demande mise à jour après l’envoi du devis',
  QUOTE_REQUEST_DECISION: 'Décision reportée sur la demande',
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
