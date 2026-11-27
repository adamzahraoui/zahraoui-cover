import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminHeading, DemoNote, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { DemoRequestList } from '../../../components/admin/RequestList'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { productName, profiles } from '../../../utils/admin'

export default function ClientProfile() {
  const { id } = useParams()
  const { data, setData } = useDemoData()
  const archiveDialog = useRef<HTMLDialogElement>(null)
  const client = data.clients.find(row => row.id === id)
  if (!client) return <NoRecord title="Client introuvable" back="/admin/clients" />

  const requests = data.requests.filter(row => row.clientId === id)
  const contracts = data.contracts.filter(row => row.clientId === id)
  const quotes = data.quotes.filter(row => row.clientId === id)
  const openRequest = requests.some(row => ['NEW', 'IN_REVIEW', 'QUOTE_SENT'].includes(row.status))
  const activePolicy = contracts.some(row => row.status === 'ACTIVE')
  const mayArchive = !openRequest && !activePolicy && !client.archived

  return (
    <>
      <AdminHeading title={client.displayName} parent={{ label: 'Clients', to: '/admin/clients' }} action={<StatusBadge label={client.archived ? 'Archivé' : 'Actif'} tone={client.archived ? 'neutral' : 'success'} />} />
      <section className="panel grid gap-4 p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Coordonnées</h2>
        <Facts items={[
          ['Nom / Raison sociale', client.displayName], ['Profil', profiles.find(item => item.value === client.profile)?.label],
          ['Téléphone fictif', client.phone], ['Email fictif', client.email || '—'], ['Ville', client.city || '—'], ['Notes', client.notes || '—'],
        ]} />
        {!client.archived && <div className="flex flex-wrap gap-2"><ActionLink to={`/admin/clients/${client.id}/modifier`}>Modifier</ActionLink><Button disabled={!mayArchive} variant="secondary" onClick={() => archiveDialog.current?.showModal()}>Archiver</Button></div>}
        {client.archived ? <LocalFeedback>Fiche archivée dans cette démonstration.</LocalFeedback> : !mayArchive && <DemoNote>Une demande ouverte ou un contrat actif empêche l’archivage.</DemoNote>}
      </section>
      <section className="grid gap-3"><h2 className="text-lg font-semibold">Demandes liées</h2><DemoRequestList rows={requests} /></section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-semibold">Historique des devis</h2>
          {quotes.length ? <ul className="grid gap-3">{quotes.map(row => <li className="flex flex-wrap items-center justify-between gap-2" key={row.id}><Link className="text-link text-sm" to={`/admin/devis/${row.id}`}>{row.reference} · {productName(row.product)}</Link><RecordStatus status={row.status} /></li>)}</ul> : <p className="text-muted">Aucun devis associé.</p>}
        </section>
        <section className="panel p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-semibold">Contrats associés</h2>
          {contracts.length ? <ul className="grid gap-3">{contracts.map(row => <li className="flex flex-wrap items-center justify-between gap-2" key={row.id}><Link className="text-link text-sm" to={`/admin/contrats/${row.id}`}>{row.reference} · {productName(row.product)}</Link><RecordStatus status={row.status} /></li>)}</ul> : <p className="text-muted">Aucun contrat associé.</p>}
        </section>
      </div>
      <Dialog title="Archiver cette fiche ?" dialogRef={archiveDialog}>
        <p className="mb-4 text-muted">La fiche restera visible dans les archives de cette démonstration.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => archiveDialog.current?.close()}>Annuler</Button>
          <Button disabled={!mayArchive} onClick={() => {
            setData(previous => ({ ...previous, clients: previous.clients.map(row => row.id === id ? { ...row, archived: true } : row) }))
            archiveDialog.current?.close()
          }}>Archiver localement</Button>
        </div>
      </Dialog>
    </>
  )
}
