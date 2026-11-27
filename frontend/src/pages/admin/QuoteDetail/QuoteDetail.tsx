import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AdminHeading, DemoNote, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { QuoteEditor } from '../../../components/admin/QuoteEditor'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import type { DemoQuote, QuoteStatus } from '../../../data/demo'
import { clientName, moneyLabel, productName } from '../../../utils/admin'

function QuoteProfile({ record }: { record: DemoQuote }) {
  const { data, setData } = useDemoData()
  const issueDialog = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const linkedContract = data.contracts.find(row => row.quoteId === record.id)
  const request = data.requests.find(row => row.id === record.requestId)
  const partner = data.partners.find(row => row.id === record.partnerId)

  function changeStatus(status: QuoteStatus) {
    setData(previous => ({ ...previous, quotes: previous.quotes.map(row => row.id === record.id ? { ...row, status } : row) }))
    setFeedback('Statut modifié dans la démonstration. Aucun document ni email n’a été généré.')
  }

  return (
    <>
      <AdminHeading title={`Devis #${record.reference}`} parent={{ label: 'Devis', to: '/admin/devis' }} action={<RecordStatus status={record.status} />} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="panel grid gap-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Informations du devis</h2>
          <Facts items={[
            ['Client', clientName(data.clients, record.clientId)],
            ['Assurance', productName(record.product)], ['Compagnie', partner?.name ?? 'Non renseignée'], ['Montant estimé (démo)', moneyLabel(record.premium)],
          ]} />
          <div className="border-t border-line pt-4"><h3 className="font-semibold">Garanties et conditions</h3><p className="mt-2 whitespace-pre-wrap text-muted">{record.conditions || 'Aucune condition saisie.'}</p></div>
        </section>
        <section className="panel grid gap-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Actions</h2>
          {record.status === 'DRAFT' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(value => !value)}>{editing ? 'Masquer le formulaire' : 'Modifier le brouillon'}</Button>
              <Button onClick={() => issueDialog.current?.showModal()}>Simuler l’émission</Button>
            </div>
          )}
          {record.status === 'ISSUED' && <div className="flex flex-wrap gap-2"><Button onClick={() => changeStatus('ACCEPTED')}>Marquer accepté · démo</Button><Button variant="secondary" onClick={() => changeStatus('DECLINED')}>Marquer refusé · démo</Button></div>}
          {record.status === 'ACCEPTED' && <ActionLink to={linkedContract ? `/admin/contrats/${linkedContract.id}` : `/admin/contrats/nouveau?devis=${record.id}`}>{linkedContract ? 'Voir le contrat lié' : 'Préparer un contrat'}</ActionLink>}
          <Button variant="secondary" disabled>Télécharger le PDF</Button>
          <DemoNote>Le PDF sera disponible après raccordement au service de documents.</DemoNote>
          {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
        </section>
      </div>
      {record.status === 'DRAFT' && editing && <QuoteEditor key={JSON.stringify(record)} record={record} request={request} />}
      <Dialog title="Simuler l’émission ?" dialogRef={issueDialog}>
        <p className="mb-4 text-muted">Cette action change seulement le statut affiché dans la démonstration.</p>
        <Button onClick={() => { changeStatus('ISSUED'); issueDialog.current?.close() }}>Confirmer la simulation</Button>
      </Dialog>
    </>
  )
}

export default function QuoteDetail() {
  const { id } = useParams()
  const { data } = useDemoData()
  const record = data.quotes.find(row => row.id === id)
  return record ? <QuoteProfile key={record.id} record={record} /> : <NoRecord title="Devis introuvable" back="/admin/devis" />
}
