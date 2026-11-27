import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AdminHeading, Facts, LocalFeedback, NoRecord, RecordStatus } from '../../../components/admin/AdminContent'
import { ActivityList, activityDate } from '../../../components/admin/ActivityList'
import { quoteAmount } from '../../../components/admin/IssuedQuoteList'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Input, Textarea } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, api, businessError } from '../../../services/api'
import type { ContractDetail as Policy } from '../../../types/api'
import { dateLabel } from '../../../utils/admin'
import { ContractEditor } from './ContractEditor'

type Action = 'confirm' | 'cancel' | 'renew'
const titles: Record<Action, string> = {
  confirm: 'Enregistrer la confirmation de l’assureur', cancel: 'Annuler la fiche de contrat', renew: 'Préparer le renouvellement',
}
const reminderLabels = { PENDING: 'Planifié', RUNNING: 'En cours', SUCCEEDED: 'Accepté par SMTP', FAILED: 'Échec', OBSOLETE: 'Obsolète' }
const maxPdf = 4 * 1024 * 1024

function ContractProfile({ record, save, reload }: { record: Policy; save: (contract: Policy) => void; reload: () => void }) {
  const { state } = useAdminSession()
  const location = useLocation()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [action, setAction] = useState<Action>('confirm')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(location.state?.saved ? 'Brouillon enregistré.' : '')
  const [error, setError] = useState('')
  const admin = state.status === 'authenticated' && state.user.role === 'ADMIN'
  const draft = record.status === 'DRAFT'
  const canUpload = record.uploadEnabled && ['DRAFT', 'ACTIVE', 'SCHEDULED'].includes(record.status)

  function ask(action: Action) {
    setAction(action)
    setError('')
    dialog.current?.showModal()
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || state.status !== 'authenticated') return
    const values = new FormData(event.currentTarget)
    const text = (name: string) => String(values.get(name) ?? '').trim()
    setBusy(true)
    setError('')
    const csrf = state.user.csrfToken
    try {
      if (action === 'renew') {
        const next = await api.startRenewal(record.id, { version: record.version, effectiveOn: text('renewStart'), expiresOn: text('renewEnd') }, csrf)
        dialog.current?.close()
        navigate(`/admin/contrats/${next.id}`, { state: { saved: true } })
      } else {
        const changed = await api.changeContractStatus(record.id, action === 'confirm'
          ? { version: record.version, status: 'ACTIVE', confirmationReference: text('confirmationReference'), confirmationOn: text('confirmationOn') }
          : { version: record.version, status: 'CANCELLED', reason: text('reason') }, csrf)
        dialog.current?.close()
        save(changed)
        setFeedback(action === 'confirm' ? 'Confirmation de l’assureur enregistrée.' : 'Fiche annulée.')
      }
    } catch (error) {
      dialog.current?.close()
      setError(businessError(error))
    } finally { setBusy(false) }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || state.status !== 'authenticated') return
    const form = event.currentTarget
    const file = new FormData(form).get('policyDocument')
    if (!(file instanceof File) || file.type !== 'application/pdf' || !file.size || file.size > maxPdf) {
      setError('Choisissez un PDF de 4 Mio maximum.')
      return
    }
    setBusy(true)
    setError('')
    try {
      save(await api.attachPolicy(record.id, record.version, file, state.user.csrfToken))
      form.reset()
      setFeedback('Pièce jointe enregistrée.')
    } catch (error) { setError(businessError(error)) }
    finally { setBusy(false) }
  }

  return <>
    <AdminHeading title={`Contrat ${record.reference}`} parent={{ label: 'Contrats', to: '/admin/contrats' }} action={<RecordStatus status={record.status} />} />
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {draft ? <ContractEditor key={record.version} record={record} saved={saved => { save(saved); setFeedback('Brouillon enregistré.') }} /> : (
        <section className="panel grid min-w-0 gap-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Informations du contrat</h2>
          <Facts items={[
            ['Police de l’assureur', record.policyNumber], ['Client', <Link className="text-link" to={`/admin/clients/${record.clientId}`}>{record.clientName}</Link>],
            ['Catégorie', record.productTitle], ['Compagnie', record.partnerName],
            ['Date d’effet', dateLabel(record.effectiveOn)], ['Échéance (jour exclu)', dateLabel(record.expiresOn)],
            ['Prime', record.premiumMad ? quoteAmount(record.premiumMad) : '—'],
            ['Devis source', record.quoteId && record.quoteReference ? <Link className="text-link" to={`/admin/devis/${record.quoteId}`}>{record.quoteReference}</Link> : '—'],
            ['Confirmation de l’assureur', record.confirmationReference], ['Date de confirmation', record.confirmationOn ? dateLabel(record.confirmationOn) : '—'],
            ['Enregistrée par', record.confirmer?.displayName], ['Motif d’annulation', record.cancellationReason],
          ]} />
          {record.coverage && <div><h3 className="font-semibold">Garanties</h3><p className="whitespace-pre-wrap wrap-anywhere text-muted">{record.coverage}</p></div>}
          {record.internalNotes && <div><h3 className="font-semibold">Notes internes</h3><p className="whitespace-pre-wrap wrap-anywhere text-muted">{record.internalNotes}</p></div>}
        </section>
      )}
      <section className="panel grid min-w-0 gap-3 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Actions</h2>
        <p className="text-sm text-muted">{draft ? 'Cette fiche est un brouillon interne. La compagnie doit confirmer la police.' : 'La fiche retrace la confirmation saisie par le courtier. Consultez la police de l’assureur pour ses garanties.'}</p>
        {record.status === 'SCHEDULED' && <p className="text-sm font-medium text-primary">La date d’effet est à venir.</p>}
        {record.status === 'UNVERIFIED' && <p className="text-sm text-muted">Fiche historique sans confirmation enregistrée.</p>}
        <div className="flex flex-wrap gap-2">
          {admin && draft && <Button onClick={() => ask('confirm')}>Confirmer et activer</Button>}
          {admin && ['DRAFT', 'ACTIVE', 'SCHEDULED', 'UNVERIFIED'].includes(record.status) && <Button variant="secondary" onClick={() => ask('cancel')}>Annuler la fiche</Button>}
          {record.confirmed && !record.successorId && ['ACTIVE', 'EXPIRED'].includes(record.status) && <Button variant="secondary" onClick={() => ask('renew')}>Préparer le renouvellement</Button>}
        </div>
        {record.previous && <Link className="text-link text-sm" to={`/admin/contrats/${record.previous.id}`}>Contrat précédent · {record.previous.reference}</Link>}
        {record.successorId && <Link className="text-link text-sm" to={`/admin/contrats/${record.successorId}`}>{record.renewed ? 'Successeur confirmé' : 'Brouillon de renouvellement'} · {record.successorReference}</Link>}
        {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
        {error && <ErrorState>{error} <Button variant="secondary" onClick={reload}>Recharger la fiche</Button></ErrorState>}
      </section>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="panel grid min-w-0 gap-3 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Pièces de l’assureur</h2>
        {record.documents.length ? <ul className="grid gap-2">{record.documents.map(doc => <li key={doc.id}>
          <a className="text-link" href={`/api/admin/documents/${encodeURIComponent(doc.id)}/download`} download>Télécharger la pièce {doc.revision}</a>
          <span className="text-sm text-muted"> · {activityDate(doc.createdAt)}</span>
        </li>)}</ul> : <p className="text-sm text-muted">Aucune pièce déposée.</p>}
        {canUpload ? <form className="grid gap-3" onSubmit={upload}>
          <Input label="PDF fourni par l’assureur" name="policyDocument" type="file" accept="application/pdf,.pdf" required hint="PDF de 4 Mio maximum. Dépôt réservé aux essais locaux." />
          <div><Button type="submit" variant="secondary" disabled={busy}>Joindre le PDF</Button></div>
        </form> : !record.uploadEnabled && <p className="text-sm text-muted">Le dépôt local de pièces est indisponible.</p>}
      </section>
      <section className="panel grid min-w-0 gap-3 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Rappels d’échéance</h2>
        {!record.reminderDeliveryEnabled && <p className="text-sm text-muted">L’envoi interne est désactivé dans cet environnement.</p>}
        {record.reminders.length ? <ul className="grid gap-2 text-sm">{record.reminders.map(reminder => <li className="flex flex-wrap justify-between gap-1" key={reminder.id}>
          <span>{reminder.days ? `J−${reminder.days}` : 'Planification historique'} · {activityDate(reminder.finishedAt ?? reminder.nextAttemptAt)}</span>
          <span className="font-medium">{reminderLabels[reminder.status]}</span>
        </li>)}</ul> : <p className="text-sm text-muted">Aucun rappel planifié.</p>}
        {record.reminders.some(job => job.status === 'PENDING' || job.status === 'RUNNING') && <div><Button variant="secondary" onClick={reload}>Actualiser les rappels</Button></div>}
      </section>
    </div>
    <section className="panel grid gap-3 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Historique du contrat et des renouvellements</h2>
      {record.renewalHistory.length > 1 && <ul className="grid gap-2 text-sm">{record.renewalHistory.map(row => <li key={row.id}>
        {row.id === record.id ? <span>{row.reference}</span> : <Link className="text-link" to={`/admin/contrats/${row.id}`}>{row.reference}</Link>}
        {row.activatedAt && <span className="text-muted"> · Confirmation enregistrée</span>}
      </li>)}</ul>}
      <ActivityList activity={record.activity} />
    </section>
    <Dialog title={titles[action]} dialogRef={dialog}>
      <form key={action} className="grid gap-4" onSubmit={run}>
        {action === 'confirm' ? <>
          <p className="text-sm text-muted">Confirmez uniquement après avoir vérifié les documents et l’accord de l’assureur.</p>
          <Input label="Référence de confirmation de l’assureur" name="confirmationReference" minLength={3} maxLength={160} required />
          <Input label="Date de confirmation de l’assureur" name="confirmationOn" type="date" required />
          <label className="flex gap-2 text-sm"><input type="checkbox" className="accent-primary" required /> J’ai vérifié la confirmation de l’assureur.</label>
        </> : action === 'cancel' ? <Textarea label="Motif d’annulation" name="reason" minLength={3} maxLength={1000} required /> : <>
          <p className="text-sm text-muted">Le dossier précédent et ses pièces seront conservés. La nouvelle période reste en brouillon jusqu’à confirmation.</p>
          <Input label="Nouvelle date d’effet" type="date" name="renewStart" min={record.expiresOn} defaultValue={record.expiresOn} required />
          <Input label="Nouvelle échéance (jour exclu)" type="date" name="renewEnd" min={record.expiresOn} required />
        </>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => dialog.current?.close()}>Fermer</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Traitement…' : 'Confirmer'}</Button>
        </div>
      </form>
    </Dialog>
  </>
}

export function ContractDetail({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => api.contract(id, signal), [id])
  const { data, loading, error, reload, setData } = useApiData(load)
  const record = data?.id === id ? data : undefined
  if (error instanceof ApiError && [400, 404].includes(error.status)) return <NoRecord title="Contrat introuvable" back="/admin/contrats" />
  return <>
    {!record && <AdminHeading title="Contrat" />}
    {!record && loading && <LoadingState />}
    {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
    {record && <ContractProfile key={id} record={record} save={setData} reload={reload} />}
  </>
}
