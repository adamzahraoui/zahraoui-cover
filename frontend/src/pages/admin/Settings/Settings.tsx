import { ActivityList } from '../../../components/admin/ActivityList'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import { CompanyForm, NotificationsForm } from './AgencyForms'
import { LegalContents } from './LegalContents'
import { StaffManagement } from './StaffManagement'

const labels: Record<string, string> = {
  logo: 'Logo officiel', legal: 'Mentions légales', privacy: 'Notice de confidentialité', catalog: 'Contenu du catalogue',
  quote: 'Texte des propositions', smtp: 'SMTP de production', malware: 'Analyse de fichiers', storage: 'Stockage privé durable',
  migration: 'Migration des données', backup: 'Sauvegarde et restauration', https: 'Configuration HTTPS',
}

function Readiness() {
  const readiness = useApiData(api.readiness)
  return <section id="production" className="panel grid gap-3 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Préparation à la production</h2>
    <p className="text-sm text-muted">Les éléments configurés restent à vérifier sur le déploiement. Ces indicateurs sont en lecture seule.</p>
    {readiness.loading && <LoadingState />}
    {readiness.error && <ErrorState>{businessError(readiness.error)} <Button variant="secondary" onClick={readiness.reload}>Réessayer</Button></ErrorState>}
    {readiness.data && <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {readiness.data.map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded border border-line p-2">
        <span className="text-sm">{labels[item.id]}{item.detail && ' · ' + item.detail}</span>
        <StatusBadge label={item.state === 'VERIFIED' ? 'Vérifié' : item.state === 'CONFIGURED' ? 'Configuré' : 'En attente'}
          tone={item.state === 'VERIFIED' ? 'success' : item.state === 'CONFIGURED' ? 'info' : 'warning'} />
      </li>)}
    </ul>}
  </section>
}

export default function Settings() {
  const { state } = useAdminSession()
  const settings = useApiData(api.settings)
  const csrf = state.status === 'authenticated' ? state.user.csrfToken : ''
  return <>
    <AdminHeading title="Paramètres de l’agence" />
    <nav aria-label="Sections des paramètres" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {[['informations', 'Informations générales'], ['coordonnees', 'Coordonnées'], ['legal', 'Informations légales'], ['notifications', 'Notifications'],
        ['renouvellements', 'Renouvellements'], ['personnel', 'Personnel'], ['securite', 'Sécurité'], ['production', 'Production']].map(([id, text]) =>
        <a key={id} className="text-link" href={'#' + id}>{text}</a>)}
    </nav>
    {settings.loading && !settings.data && <LoadingState />}
    {settings.error && <ErrorState>{businessError(settings.error)} <Button variant="secondary" onClick={settings.reload}>Actualiser les paramètres</Button></ErrorState>}
    {settings.data && <>
      <CompanyForm settings={settings.data} csrf={csrf} saved={settings.setData} />
      <LegalContents csrf={csrf} refresh={settings.reload} />
      <NotificationsForm settings={settings.data} csrf={csrf} saved={settings.setData} />
      <StaffManagement csrf={csrf} />
      <section id="securite" className="panel grid gap-3 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Sécurité</h2>
        <p className="text-sm text-muted">Les mots de passe sont gérés par chaque membre. Les invitations utilisent des liens à usage unique, valables 30 minutes.</p>
        <Button variant="secondary" className="justify-self-start" onClick={settings.reload}>Actualiser l’activité</Button>
        <ActivityList activity={settings.data.activity} />
      </section>
      <Readiness key={settings.data.activity.find(entry => entry.action === 'AGENCY_CONTENT_PUBLISHED')?.id ?? 'readiness'} />
    </>}
  </>
}
