import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AdminHeading, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { activityDate } from '../../../components/admin/ActivityList'
import { quoteAmount } from '../../../components/admin/IssuedQuoteList'
import { QuoteEditor } from '../../../components/admin/QuoteEditor'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, api, businessError } from '../../../services/api'
import type { DecisionMethod, IssuedQuote } from '../../../types/api'
import { dateLabel } from '../../../utils/admin'

const actions = {
  issue: { button: 'Générer le PDF', title: 'Finaliser le devis ?', description: 'Les informations seront figées dans cette révision. Aucun email ne sera envoyé.', feedback: 'Génération du PDF mise en file.' },
  send: { button: 'Envoyer le devis', title: 'Envoyer le devis de test ?', description: 'Le PDF de cette révision sera joint à un message de test pour le client vérifié.', feedback: 'Envoi mis en file.' },
  'retry-pdf': { button: 'Relancer la génération', title: 'Relancer la génération ?', description: 'Le PDF sera régénéré à partir des informations figées.', feedback: 'Génération du PDF mise en file.' },
  cancel: { button: 'Annuler le devis', title: 'Annuler le devis ?', description: 'Cette révision restera disponible dans l’historique.', feedback: 'Devis annulé.' },
  revision: { button: 'Créer une révision', title: 'Créer une nouvelle révision ?', description: 'Un nouveau brouillon sera créé. Le PDF de la révision précédente sera conservé.', feedback: 'Révision créée.' },
} as const
type Action = keyof typeof actions
const methods: { value: DecisionMethod; label: string }[] = [
  { value: 'EMAIL', label: 'Email' }, { value: 'PHONE', label: 'Téléphone' },
  { value: 'IN_PERSON', label: 'En agence' }, { value: 'LETTER', label: 'Courrier' },
]

function DecisionForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form className="grid gap-3 border-t border-line pt-4" onSubmit={onSubmit}>
    <h3 className="font-semibold">Décision du client</h3>
    <p className="text-sm text-muted">Saisissez une décision vérifiée et sa preuve ou référence de suivi.</p>
    <Select label="Décision" name="decision" placeholder="Choisir" options={[{ value: 'ACCEPTED', label: 'Acceptation' }, { value: 'DECLINED', label: 'Refus' }]} required />
    <Select label="Mode de communication" name="method" placeholder="Choisir" options={methods} required />
    <Textarea label="Référence ou note de suivi" name="evidence" minLength={3} maxLength={1000} required />
    <div><Button type="submit" disabled={busy}>Enregistrer la décision</Button></div>
  </form>
}

function QuoteProfile({ record, save, reload }: { record: IssuedQuote; save: (quote: IssuedQuote) => void; reload: () => void }) {
  const { state } = useAdminSession()
  const location = useLocation()
  const [action, setAction] = useState<Action>('issue')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState(location.state?.saved ? 'Brouillon enregistré.' : '')
  const dialog = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const admin = state.status === 'authenticated' && state.user.role === 'ADMIN'
  const doc = record.documents[0]
  const sending = doc?.delivery === 'PENDING' || doc?.delivery === 'RUNNING'
  const verified = Boolean(record.client.email && !record.client.intakeProvisional && !record.client.archivedAt)
  const pdfHref = doc && '/api/admin/documents/' + encodeURIComponent(doc.id) + '/download'
  const delivery = doc?.delivery === 'SUCCEEDED' ? 'Accepté par le serveur SMTP' : doc?.delivery === 'FAILED' ? 'Échec de l’envoi'
    : sending ? 'Envoi en attente' : 'Aucun envoi'

  function ask(action: Action) {
    setAction(action)
    setError('')
    dialog.current?.showModal()
  }

  async function runAction() {
    if (!admin || state.status !== 'authenticated' || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = await api.quoteAction(record.id, action, record.version, state.user.csrfToken)
      dialog.current?.close()
      setEditing(false)
      if (action === 'revision') navigate(`/admin/devis/${updated.id}`, { state: { saved: true } })
      else { save(updated); setFeedback(actions[action].feedback) }
    } catch (error) {
      dialog.current?.close()
      setError(businessError(error))
    } finally { setBusy(false) }
  }

  async function recordDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!admin || state.status !== 'authenticated' || busy) return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      save(await api.quoteDecision(record.id, {
        version: record.version, status: fields.get('decision') === 'DECLINED' ? 'DECLINED' : 'ACCEPTED',
        method: fields.get('method') as DecisionMethod, evidence: String(fields.get('evidence') ?? ''),
      }, state.user.csrfToken))
      setFeedback('Décision enregistrée.')
    } catch (error) {
      setError(businessError(error))
    } finally { setBusy(false) }
  }

  return <>
    <AdminHeading title={`Devis #${record.reference}`} parent={{ label: 'Devis', to: '/admin/devis' }} action={<RecordStatus status={record.status} />} />
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="panel grid min-w-0 gap-5 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Informations du devis</h2>
        <Facts items={[
          ['Client', <Link className="text-link" to={`/admin/clients/${record.clientId}`}>{record.clientName}</Link>],
          ['Demande liée', record.requestId && record.requestReference ? <Link className="text-link" to={`/admin/demandes/${record.requestId}`}>{record.requestReference}</Link> : '—'],
          ['Assurance', record.productTitle], ['Compagnie', record.partnerName], ['Révision', record.revision],
          ['Validité jusqu’au', record.validUntil ? dateLabel(record.validUntil) : '—'],
          ['Prime annuelle', quoteAmount(record.annualPremiumMad)], ['Frais', quoteAmount(record.feesMad)],
          ['Taxes', quoteAmount(record.taxesMad)], ['Total', quoteAmount(record.totalMad)],
        ]} />
        <div className="grid gap-3 border-t border-line pt-4">
          {([
            ['Garanties proposées', record.coverage], ['Plafonds et limites', record.coverageLimits],
            ['Franchises', record.deductibles], ['Conditions et exclusions', record.conditions],
            ['Notes destinées au client', record.customerNotes], ['Notes internes', record.internalNotes],
          ] as const).map(([label, value]) => value && <div key={label}><h3 className="font-semibold">{label}</h3><p className="mt-1 whitespace-pre-wrap wrap-anywhere text-muted">{value}</p></div>)}
        </div>
      </section>
      <aside className="panel grid min-w-0 gap-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Actions</h2>
        <p className="text-sm text-muted">Une proposition de courtage ne rend pas les garanties effectives. Les PDF et envois sont réservés aux essais locaux.</p>
        <Facts items={[
          ['Émission', record.issuedAt ? activityDate(record.issuedAt) : '—'],
          ['PDF', doc?.status === 'READY' ? 'Prêt' : doc?.status === 'QUEUED' ? 'En cours de génération' : doc?.status === 'FAILED' ? 'Échec de génération' : '—'],
          ['Livraison', delivery], ['Date d’envoi', record.sentAt ? activityDate(record.sentAt) : '—'],
        ]} />
        <div className="flex flex-wrap gap-2">
          {record.status === 'DRAFT' && <Button variant="secondary" onClick={() => setEditing(value => !value)}>{editing ? 'Masquer le formulaire' : 'Modifier le brouillon'}</Button>}
          {admin && record.status === 'DRAFT' && record.pdfEnabled && <Button onClick={() => ask('issue')}>{actions.issue.button}</Button>}
          {admin && record.status === 'ISSUED' && doc?.status === 'FAILED' && record.pdfEnabled && <Button onClick={() => ask('retry-pdf')}>{actions['retry-pdf'].button}</Button>}
          {doc?.status === 'READY' && pdfHref && <>
            <a className="action action-secondary" href={pdfHref + '?inline=true'} target="_blank" rel="noopener">Aperçu PDF</a>
            <a className="action action-secondary" href={pdfHref} download>Télécharger le PDF</a>
          </>}
          {admin && record.status === 'ISSUED' && doc?.status === 'READY' && record.deliveryEnabled && !sending &&
            <Button disabled={!verified} onClick={() => ask('send')}>{doc.delivery === 'FAILED' ? 'Réessayer l’envoi' : actions.send.button}</Button>}
          {admin && ['DRAFT', 'ISSUED', 'SENT'].includes(record.status) && !sending && <Button variant="secondary" onClick={() => ask('cancel')}>{actions.cancel.button}</Button>}
          {admin && record.issuedAt && !record.hasNext && record.status !== 'ACCEPTED' && !sending && <Button variant="secondary" onClick={() => ask('revision')}>{actions.revision.button}</Button>}
        </div>
        {record.status === 'ISSUED' && !verified && <p className="text-sm text-muted">Vérifiez la fiche et l’adresse du client avant l’envoi.</p>}
        {admin && record.status === 'SENT' && !record.hasNext && <DecisionForm onSubmit={recordDecision} busy={busy} />}
        {record.status === 'ACCEPTED' && <div><ActionLink to={`/admin/contrats/nouveau?devis=${record.id}`} variant="secondary">Créer le contrat</ActionLink></div>}
        {record.decidedAt && <Facts items={[
          ['Décision enregistrée le', activityDate(record.decidedAt)], ['Par', record.decisionActor?.displayName],
          ['Communication', methods.find(method => method.value === record.decisionMethod)?.label],
          ['Suivi', record.decisionEvidence],
        ]} />}
        {error && <ErrorState>{error} <Button variant="secondary" onClick={reload}>Recharger le devis</Button></ErrorState>}
        {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
      </aside>
    </div>
    {record.status === 'DRAFT' && editing && <QuoteEditor key={record.version} record={record} onSaved={updated => { save(updated); setEditing(false); setFeedback('Brouillon enregistré.') }} />}
    <section className="panel grid gap-3 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Historique des révisions</h2>
      <ul className="grid gap-2">{record.revisions.map(revision => <li className="flex flex-wrap items-center justify-between gap-2" key={revision.id}>
        {revision.id === record.id ? <span className="wrap-anywhere">Révision {revision.revision} · {revision.reference}</span>
          : <Link to={`/admin/devis/${revision.id}`} className="text-link wrap-anywhere">Révision {revision.revision} · {revision.reference}</Link>}
        <RecordStatus status={revision.status} />
      </li>)}</ul>
    </section>
    <Dialog title={actions[action].title} dialogRef={dialog}>
      <p className="mb-4 text-muted">{actions[action].description}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => dialog.current?.close()}>Fermer</Button>
        <Button disabled={busy} onClick={() => { void runAction() }}>{busy ? 'Traitement…' : 'Confirmer'}</Button>
      </div>
    </Dialog>
  </>
}

export default function QuoteDetail() {
  const { id } = useParams()
  const load = useCallback((signal: AbortSignal) => api.issuedQuote(id ?? '', signal), [id])
  const { data, loading, error, reload, setData } = useApiData(load)
  const record = data?.id === id ? data : undefined
  const doc = record?.documents[0]
  const pending = doc?.status === 'QUEUED' || doc?.delivery === 'PENDING' || doc?.delivery === 'RUNNING'
  useEffect(() => {
    if (!pending || loading || error) return
    const timer = window.setTimeout(reload, 1250)
    return () => window.clearTimeout(timer)
  }, [pending, loading, error, reload])
  if (error instanceof ApiError && [400, 404].includes(error.status)) return <NoRecord title="Devis introuvable" back="/admin/devis" />
  return <>
    {!record && <AdminHeading title="Devis" />}
    {!record && loading && <LoadingState />}
    {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
    {record && <QuoteProfile key={record.id} record={record} save={setData} reload={reload} />}
  </>
}
