import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ActivityList } from '../../../components/admin/ActivityList'
import { AdminHeading, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { IssuedQuoteList } from '../../../components/admin/IssuedQuoteList'
import { RequestList } from '../../../components/admin/RequestList'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, api, businessError } from '../../../services/api'
import { profiles } from '../../../utils/admin'

export default function ClientProfile() {
  const { id } = useParams()
  const { state } = useAdminSession()
  const location = useLocation()
  const archiveDialog = useRef<HTMLDialogElement>(null)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback((signal: AbortSignal) => api.client(id ?? '', signal), [id])
  const { data, loading, error, reload, setData } = useApiData(load)
  const client = data?.id === id ? data : undefined

  if (error instanceof ApiError && [400, 404].includes(error.status)) return <NoRecord title="Client introuvable" back="/admin/clients" />

  async function archive() {
    if (!client || state.status !== 'authenticated' || busy) return
    setFailure('')
    setBusy(true)
    try {
      const saved = await api.archiveClient(client.id, client.version, state.user.csrfToken)
      setData({ ...client, ...saved })
      archiveDialog.current?.close()
      reload()
    } catch (error) {
      setFailure(businessError(error))
    } finally { setBusy(false) }
  }

  return (
    <>
      <AdminHeading title={client?.displayName ?? 'Fiche client'} parent={{ label: 'Clients', to: '/admin/clients' }} action={client && <StatusBadge label={client.archivedAt ? 'Archivé' : client.intakeProvisional ? 'Provisoire' : 'Vérifié'} tone={client.archivedAt || client.intakeProvisional ? 'neutral' : 'success'} />} />
      {loading && <LoadingState />}
      {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
      {client && <>
        {location.state?.savedClient && <LocalFeedback>Fiche client enregistrée.</LocalFeedback>}
        <section className="panel grid gap-4 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Coordonnées</h2>
          <Facts items={[
            ['Nom / Raison sociale', client.displayName], ['Profil', profiles.find(item => item.value === client.profile)?.label],
            ['Téléphone', client.phone], ['Email', client.email || '—'], ['Ville', client.city || '—'], ['Notes', client.notes || '—'],
          ]} />
          {!client.archivedAt && <div className="flex flex-wrap gap-2">
            <ActionLink to={`/admin/clients/${client.id}/modifier`}>Modifier</ActionLink>
            {state.status === 'authenticated' && state.user.role === 'ADMIN' && <Button variant="secondary" onClick={() => { setFailure(''); archiveDialog.current?.showModal() }}>Archiver</Button>}
          </div>}
        </section>
        <section className="grid gap-3"><h2 className="text-lg font-semibold">Demandes de devis liées</h2><RequestList rows={client.recentRequests} label="Demandes de devis liées" /></section>
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Devis associés</h2>
            <Link className="text-link text-sm" to={`/admin/devis?clientId=${client.id}`}>Voir tous les devis</Link>
          </div>
          <IssuedQuoteList rows={client.recentQuotes} label="Devis associés" />
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-semibold">Demandes d’assistance liées</h2>
            {client.recentAssistance.length ? <ul className="grid gap-3">{client.recentAssistance.map(row => <li className="flex flex-wrap items-center justify-between gap-2" key={row.id}><Link className="text-link text-sm" to={`/admin/assistance?id=${row.id}`}>{row.reference}</Link><RecordStatus status={row.status} /></li>)}</ul> : <p className="text-muted">Aucune demande d’assistance liée.</p>}
          </section>
          <section className="panel p-4 sm:p-5"><h2 className="mb-3 text-lg font-semibold">Historique de la fiche</h2><ActivityList activity={client.activity} /></section>
        </div>
        <Dialog title="Archiver cette fiche ?" dialogRef={archiveDialog}>
          <p className="mb-4 text-muted">La fiche et ses dossiers resteront consultables dans les archives.</p>
          {failure && <ErrorState>{failure} <Button variant="secondary" onClick={() => { archiveDialog.current?.close(); reload() }}>Recharger la fiche</Button></ErrorState>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => archiveDialog.current?.close()}>Annuler</Button>
            <Button disabled={busy} onClick={() => { void archive() }}>Confirmer l’archivage</Button>
          </div>
        </Dialog>
      </>}
    </>
  )
}
