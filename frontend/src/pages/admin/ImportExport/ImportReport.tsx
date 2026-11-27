import { Link } from 'react-router-dom'
import { activityDate } from '../../../components/admin/ActivityList'
import { Facts } from '../../../components/admin/AdminContent'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import type { ImportDiagnostic, ImportJob } from '../../../types/api'

export const importKinds = [
  { value: 'CLIENTS', label: 'Clients' },
  { value: 'PARTNERS', label: 'Compagnies partenaires' },
  { value: 'CONTRACTS', label: 'Contrats existants' },
] as const

export const importStatuses = { UPLOADED: 'Déposé', VALIDATED: 'Validé', COMPLETED: 'Terminé', EXPIRED: 'Expiré' }
const destinations = { CLIENTS: 'clients', PARTNERS: 'partenaires', CONTRACTS: 'contrats' }
const messages: Record<string, string> = {
  REQUIRED_FIELD: 'Champ obligatoire manquant', INVALID_FIELD: 'Valeur invalide', INVALID_IDENTIFIER: 'Identifiant historique invalide',
  FORMULA_TEXT: 'Saisissez une valeur sans formule', TEXT_REQUIRED: 'Cellule de type texte requise', INVALID_CATEGORY: 'Catégorie inconnue', INVALID_DATE: 'Date invalide ou ambiguë',
  INVALID_PERIOD: 'Échéance antérieure ou égale à la prise d’effet', UNRESOLVED_RELATION: 'Lien introuvable',
  AMBIGUOUS_RELATION: 'Lien ambigu', PARTNER_INELIGIBLE: 'Compagnie non admissible pour cette catégorie',
  FILE_DUPLICATE: 'Doublon dans le fichier', LEGACY_EXISTS: 'Référence historique déjà enregistrée',
  CUSTOMER_DUPLICATE: 'Coordonnées déjà utilisées', PARTNER_DUPLICATE: 'Raison sociale déjà utilisée', POLICY_DUPLICATE: 'Police déjà enregistrée',
}

export function ImportReport({ job, fields = [] }: { job: ImportJob; fields?: { key: string; label: string }[] }) {
  const { counts } = job
  const columns: Column<ImportDiagnostic & { id: string }>[] = [
    { title: 'Ligne', render: row => row.line },
    { title: 'Résultat', render: row => row.state === 'VALID' ? 'Création proposée' : row.state === 'INVALID' ? 'À corriger' : 'À ignorer' },
    { title: 'Détail', render: row => row.code && <>{messages[row.code] ?? row.code}{row.field && ' · ' + (fields.find(field => field.key === row.field)?.label ?? row.field)}</> },
  ]
  return <div className="grid gap-4">
    <Facts items={[
      ['Identifiant', job.id], ['Administrateur', job.administrator],
      ['État', importStatuses[job.status]], ['Date', activityDate(job.completedAt ?? job.createdAt)],
    ]} />
    {counts && <Facts items={[
      ['Lignes au total', counts.total], ['Lignes valides', counts.valid], ['Lignes rejetées', counts.rejected],
      ['Doublons ignorés', counts.skipped], ['Dossiers créés', counts.created],
    ]} />}
    {job.status !== 'COMPLETED' && job.diagnostics && <RecordList label="Validation par ligne" pageSize={10}
      rows={job.diagnostics.map(row => ({ ...row, id: String(row.line) }))} columns={columns} />}
    {job.diagnostics?.some(row => row.code) && <div>
      <a className="text-link" href={'/api/admin/imports/' + job.id + '/errors'} download>Télécharger le rapport d’erreurs</a>
    </div>}
    {!!job.createdRecords?.length && <div>
      <h3 className="font-semibold">Dossiers créés</h3>
      <ul className="mt-2 grid gap-2">{job.createdRecords.map(record => <li key={record.id}>
        <Link className="text-link" to={'/admin/' + (job.kind === 'PARTNERS' ? 'partenaires?fiche=' : destinations[job.kind] + '/') + record.id}>Ouvrir le dossier de la ligne {record.line}</Link>
      </li>)}</ul>
    </div>}
  </div>
}
