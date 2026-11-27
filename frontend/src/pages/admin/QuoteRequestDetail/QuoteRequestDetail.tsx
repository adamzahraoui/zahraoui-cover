import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AdminHeading, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, api, businessError } from '../../../services/api'
import type { RequestDetail, RequestStatus } from '../../../types/api'
import { statusOptions } from '../../../utils/admin'

const loadAdvisors = (signal: AbortSignal) => api.staffOptions('limit=100', signal)
const dateTime = new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Casablanca' })

function RequestEditor({ record, save, reload }: { record: RequestDetail; save: (record: RequestDetail) => void; reload: () => void }) {
  const { state } = useAdminSession()
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const advisors = useApiData(loadAdvisors)
  const loadClients = useCallback((signal: AbortSignal) =>
    query.trim().length >= 2
      ? api.clientOptions(new URLSearchParams({ q: query.trim() }).toString(), signal)
      : Promise.resolve(undefined), [query])
  const clients = useApiData(loadClients)
  const clientOptions = (clients.data?.data ?? []).filter(row => row.id !== record.clientId)
  const advisorOptions = (advisors.data?.data ?? []).filter(row => row.id !== record.assignedTo)

  async function submit(event: FormEvent<HTMLFormElement>, addNote = false) {
    event.preventDefault()
    if (state.status !== 'authenticated' || busy) return
    const form = new FormData(event.currentTarget)
    setError('')
    setFeedback('')
    setBusy(true)
    try {
      const token = state.user.csrfToken
      if (addNote) {
        save(await api.addQuoteNote(record.id, { version: record.version, body: note.trim() }, token))
        setNote('')
      } else {
        const status = String(form.get('status')) as RequestStatus
        const assignee = String(form.get('assignee') ?? '') || null
        const clientId = String(form.get('client') ?? '')
        const update = {
          version: record.version,
          status: status !== record.status ? status : undefined,
          assignedTo: assignee !== (record.assignedTo ?? null) ? assignee : undefined,
          clientId: clientId && clientId !== record.clientId ? clientId : undefined,
        }
        if (update.status === undefined && update.assignedTo === undefined && update.clientId === undefined) {
          setFeedback('Aucune modification à enregistrer.')
          return
        }
        save(await api.updateQuoteRequest(record.id, update, token))
      }
      setFeedback('Dossier mis à jour.')
    } catch (failure) {
      setError(businessError(failure))
    } finally { setBusy(false) }
  }

  return (
    <aside className="grid gap-4">
      <form key={record.version} className="panel grid content-start gap-4 p-4 sm:p-5" onSubmit={event => { void submit(event) }}>
        <h2 className="text-lg font-semibold">Traitement du dossier</h2>
        <Select label="Statut" name="status" defaultValue={record.status} options={statusOptions([record.status, ...record.allowedStatuses])} />
        <Select label="Conseiller assigné" name="assignee" defaultValue={record.assignedTo ?? ''} placeholder="Non assigné"
          options={[...(record.assignee ? [record.assignee] : []), ...advisorOptions].map(row => ({ value: row.id, label: row.displayName }))} />
        <Input label="Rechercher un client existant" type="search" maxLength={100} value={query} onChange={event => setQuery(event.target.value)}
          hint="Vérifiez son identité avant de modifier le lien du dossier." />
        {clients.loading && query.trim().length >= 2 && <p role="status" className="text-sm text-muted">Recherche…</p>}
        {!clients.loading && query.trim().length >= 2 && !clientOptions.length && !clients.error && <p className="text-sm text-muted">Aucune autre fiche correspondante.</p>}
        {clients.error && <ErrorState>La recherche de clients est indisponible.</ErrorState>}
        <Select label="Client lié" name="client" defaultValue={record.clientId ?? ''} placeholder={record.client ? 'Conserver le client actuel' : 'Choisir une fiche cliente'}
          options={[...(record.client ? [record.client] : []), ...clientOptions].map(row => ({ value: row.id, label: `${row.displayName}${row.intakeProvisional ? ' (provisoire)' : ''}` }))} />
        <div><Button type="submit" disabled={busy}>Enregistrer le traitement</Button></div>
      </form>
      <form className="panel grid gap-3 p-4 sm:p-5" onSubmit={event => { void submit(event, true) }}>
        <Textarea label="Note interne" name="note" required maxLength={1000} value={note} onChange={event => setNote(event.target.value)}
          hint="Limitez la note aux informations nécessaires au suivi du dossier." />
        <div><Button type="submit" variant="secondary" disabled={busy || !note.trim()}>Ajouter la note</Button></div>
      </form>
      {error && <ErrorState>{error} <Button variant="secondary" onClick={reload}>Recharger le dossier</Button></ErrorState>}
      {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
    </aside>
  )
}

function Detail({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => api.quoteRequest(id, signal), [id])
  const { data: record, loading, error, reload, setData } = useApiData(load)
  if (!record) {
    if (error instanceof ApiError && [400, 404].includes(error.status)) return <NoRecord title="Demande introuvable" back="/admin/demandes" />
    return <><AdminHeading title="Demande de devis" />{loading ? <LoadingState /> : <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}</>
  }
  return (
    <>
      <AdminHeading title={`Demande #${record.reference}`} parent={{ label: 'Demandes de devis', to: '/admin/demandes' }} action={<RecordStatus status={record.status} />} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section className="panel grid gap-4 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Informations du demandeur</h2>
            <Facts items={[
              ['Nom', record.displayName], ['Téléphone', record.phone], ['Email', record.email],
              ['Ville', record.city], ['Reçue le', dateTime.format(new Date(record.createdAt))],
              ['Contact souhaité', record.preferredContact === 'EMAIL' ? 'Email' : 'Téléphone'],
              ['Notice acceptée', record.noticeVersion], ['Date d’acceptation', dateTime.format(new Date(record.acknowledgedAt))],
            ]} />
          </section>
          <section className="panel grid gap-3 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Client associé</h2>
            {record.client ? <Facts items={[
              ['Nom', record.client.displayName], ['Téléphone', record.client.phone], ['Email', record.client.email],
              ['Ville', record.client.city], ['Fiche', record.client.intakeProvisional ? 'Provisoire' : 'Existante'],
            ]} /> : <p className="text-muted">Aucun client associé.</p>}
          </section>
          <section className="panel grid gap-3 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Détails du besoin</h2>
            <p className="font-medium text-primary">{record.productTitle}</p>
            {record.desiredStartOn && <p className="text-sm text-muted">Date d’effet souhaitée · {record.desiredStartOn}</p>}
            <p className="whitespace-pre-wrap leading-7 text-muted">{record.needs}</p>
          </section>
          <section className="panel p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-semibold">Notes internes</h2>
            {record.notes.length ? <ul className="grid gap-2">{record.notes.map(note => <li key={note.id} className="rounded bg-background p-3 text-sm wrap-anywhere">
              <p className="font-semibold">{note.authorName} · {dateTime.format(new Date(note.createdAt))}</p>
              <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
            </li>)}</ul> : <p className="text-sm text-muted">Aucune note.</p>}
          </section>
        </div>
        <RequestEditor record={record} save={setData} reload={reload} />
      </div>
    </>
  )
}

export default function QuoteRequestDetail() {
  const { id = '' } = useParams()
  return <Detail key={id} id={id} />
}
