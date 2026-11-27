import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminHeading, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Select, Textarea } from '../../../components/ui/Fields'
import { demoAdvisors } from '../../../data/demo'
import type { DemoRequest } from '../../../data/demo'
import type { RequestStatus } from '../../../types/api'
import { dateLabel, productName, statusOptions } from '../../../utils/admin'

const transitions: Record<RequestStatus, RequestStatus[]> = {
  NEW: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['QUOTE_SENT', 'CLOSED'],
  QUOTE_SENT: ['ACCEPTED', 'DECLINED', 'CLOSED'],
  ACCEPTED: [],
  DECLINED: [],
  CLOSED: [],
}

function RequestEditor({ record }: { record: DemoRequest }) {
  const { data, setData } = useDemoData()
  const [feedback, setFeedback] = useState('')
  const [noteError, setNoteError] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const clients = data.clients.filter(client => !client.archived || client.id === record.clientId)

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const status = values.get('status') as RequestStatus
    const note = noteInput.trim()
    if (noteInput && !note) {
      setNoteError('Saisissez une note utile ou laissez le champ vide.')
      return
    }
    if (status !== record.status && !transitions[record.status].includes(status)) return
    setData(previous => ({
      ...previous,
      requests: previous.requests.map(row => row.id === record.id ? {
        ...row,
        status,
        assignee: String(values.get('assignee') ?? ''),
        clientId: String(values.get('client') ?? '') || undefined,
        notes: note ? [...row.notes, note] : row.notes,
      } : row),
    }))
    setNoteInput('')
    setFeedback('Le traitement a été modifié dans cette démonstration.')
  }

  return (
    <form key={record.status} className="panel grid content-start gap-4 p-4 sm:p-5" onSubmit={update} onChange={() => { setFeedback(''); setNoteError('') }}>
      <h2 className="text-lg font-semibold">Traitement du dossier</h2>
      <Select label="Statut" name="status" defaultValue={record.status} options={statusOptions([record.status, ...transitions[record.status]])} />
      <Select label="Conseiller assigné" name="assignee" defaultValue={record.assignee} placeholder="Non assigné" options={demoAdvisors} />
      <Select label="Client lié" name="client" defaultValue={record.clientId ?? ''} placeholder="Aucun client lié" options={clients.map(client => ({ value: client.id, label: client.displayName }))} />
      <Link className="text-link text-sm" to="/admin/clients/nouveau">Créer une fiche client</Link>
      <Textarea label="Note interne (facultatif)" name="note" maxLength={1000} value={noteInput} onChange={event => setNoteInput(event.target.value)} error={noteError} hint="Utilisez uniquement des exemples fictifs." />
      <div><Button type="submit">Appliquer à la démonstration</Button></div>
      {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
    </form>
  )
}

export default function QuoteRequestDetail() {
  const { id } = useParams()
  const { data } = useDemoData()
  const record = data.requests.find(row => row.id === id)
  if (!record) return <NoRecord title="Demande introuvable" back="/admin/demandes" />

  return (
    <>
      <AdminHeading title={`Demande #${record.reference}`} parent={{ label: 'Demandes de devis', to: '/admin/demandes' }} action={<RecordStatus status={record.status} />} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <section className="panel grid gap-4 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Informations du demandeur</h2>
            <Facts items={[
              ['Nom', record.name], ['Téléphone fictif', record.phone], ['Email fictif', record.email],
              ['Ville', record.city], ['Reçue le', dateLabel(record.date)],
              ['Client lié', record.clientId ? <Link className="text-link" to={`/admin/clients/${record.clientId}`}>Ouvrir la fiche</Link> : 'Aucun'],
            ]} />
          </section>
          <section className="panel grid gap-3 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Détails du besoin</h2>
            <p className="font-medium text-primary">{productName(record.product)}</p>
            <p className="leading-7 text-muted">{record.needs}</p>
            <div><ActionLink variant="secondary" to={`/admin/devis/nouveau?demande=${record.id}`}>Préparer un devis de démonstration</ActionLink></div>
          </section>
          <section className="panel p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-semibold">Notes internes</h2>
            {record.notes.length ? <ul className="grid gap-2">{record.notes.map((note, index) => <li key={index} className="rounded bg-background p-3 text-sm wrap-anywhere">{note}</li>)}</ul> : <p className="text-sm text-muted">Aucune note.</p>}
          </section>
        </div>
        <RequestEditor key={record.id} record={record} />
      </div>
    </>
  )
}
