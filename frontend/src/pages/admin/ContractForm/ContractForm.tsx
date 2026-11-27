import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AdminHeading, DemoNote, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import type { DemoContract } from '../../../data/demo'
import { clientName, dateLabel, productName } from '../../../utils/admin'
import { casablancaToday } from '../../../utils/forms'
import { ContractEditor } from './ContractEditor'

function ContractProfile({ record }: { record: DemoContract }) {
  const { data, setData } = useDemoData()
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState<'ACTIVE' | 'CANCELLED'>('ACTIVE')
  const [feedback, setFeedback] = useState(false)
  const quote = data.quotes.find(row => row.id === record.quoteId)
  const partner = data.partners.find(row => row.id === record.partnerId)
  const eligible = record.endOn > casablancaToday() && data.clients.some(row => row.id === record.clientId && !row.archived)

  function ask(status: 'ACTIVE' | 'CANCELLED') {
    setPending(status)
    dialog.current?.showModal()
  }

  function update() {
    if (pending === 'ACTIVE' && (record.status !== 'DRAFT' || !eligible)) return
    if (pending === 'CANCELLED' && record.status !== 'DRAFT' && record.status !== 'ACTIVE') return
    setData(previous => ({
      ...previous,
      contracts: previous.contracts.map(row => row.id === record.id ? { ...row, status: pending } : row),
    }))
    setFeedback(true)
    dialog.current?.close()
  }

  return (
    <>
      <AdminHeading title={`Contrat ${record.reference}`} parent={{ label: 'Contrats', to: '/admin/contrats' }} action={<RecordStatus status={record.status} />} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {record.status === 'DRAFT' ? <ContractEditor record={record} quote={quote} /> : (
          <section className="panel grid gap-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Informations du contrat</h2>
            <Facts items={[
              ['N° de police', record.policy], ['Client', <Link className="text-link" to={`/admin/clients/${record.clientId}`}>{clientName(data.clients, record.clientId)}</Link>],
              ['Catégorie', productName(record.product)], ['Compagnie', partner?.name ?? 'Non renseignée'],
              ['Date d’effet', dateLabel(record.startOn)], ['Échéance', dateLabel(record.endOn)],
              ['Devis source', quote ? <Link className="text-link" to={`/admin/devis/${quote.id}`}>{quote.reference}</Link> : '—'],
            ]} />
          </section>
        )}
        <section className="panel grid gap-3 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Actions</h2>
          {record.status === 'DRAFT' && <Button disabled={!eligible} onClick={() => ask('ACTIVE')}>Simuler l’activation</Button>}
          {record.status === 'DRAFT' && !eligible && <DemoNote>Une fiche client active et une échéance future sont nécessaires pour tester l’activation.</DemoNote>}
          {(record.status === 'DRAFT' || record.status === 'ACTIVE') && <Button variant="secondary" onClick={() => ask('CANCELLED')}>Simuler l’annulation</Button>}
          <Button variant="secondary" disabled>Télécharger le PDF</Button>
          <DemoNote>Les documents privés et rappels d’échéance nécessitent le backend.</DemoNote>
          {feedback && <LocalFeedback>Statut modifié localement. Aucun document ou rappel n’a été créé.</LocalFeedback>}
        </section>
      </div>
      <Dialog title={pending === 'ACTIVE' ? 'Simuler l’activation ?' : 'Simuler l’annulation ?'} dialogRef={dialog}>
        <p className="mb-4 text-muted">Seul le statut affiché dans cette démonstration sera modifié.</p>
        <Button onClick={update}>Confirmer la simulation</Button>
      </Dialog>
    </>
  )
}

export default function ContractForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data } = useDemoData()
  if (id) {
    const record = data.contracts.find(row => row.id === id)
    return record ? <ContractProfile key={record.id} record={record} /> : <NoRecord title="Contrat introuvable" back="/admin/contrats" />
  }
  const quoteId = params.get('devis')
  const quote = data.quotes.find(row => row.id === quoteId && row.status === 'ACCEPTED')
  if (quoteId && !quote) return <NoRecord title="Devis accepté introuvable" back="/admin/devis" />
  const existing = data.contracts.find(row => row.quoteId && row.quoteId === quoteId)
  return (
    <>
      <AdminHeading title="Nouveau contrat" parent={{ label: 'Contrats', to: '/admin/contrats' }} />
      {existing ? <div className="panel grid justify-items-start gap-3 p-4"><p>Un contrat est déjà lié à ce devis.</p><ActionLink to={`/admin/contrats/${existing.id}`}>Ouvrir le contrat</ActionLink></div>
        : <ContractEditor key={quoteId ?? 'new'} quote={quote} />}
    </>
  )
}
