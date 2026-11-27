import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Facts, LocalFeedback, RecordStatus } from '../../../components/admin/AdminContent'
import { ActivityList, activityDate } from '../../../components/admin/ActivityList'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { AssistanceCase, AssistancePatch, AssistanceStatus } from '../../../types/api'
import { statusOptions } from '../../../utils/admin'

export const priorities = [{ value: 'NORMAL', label: 'Normale' }, { value: 'URGENT', label: 'Urgente' }]
const loadAdvisors = (signal: AbortSignal) => api.staffOptions('limit=100', signal)

export function AssistanceDetails({ record, save, reload }: { record: AssistanceCase; save: (record: AssistanceCase) => void; reload: () => void }) {
  const { state } = useAdminSession()
  const [customerSearch, setCustomerSearch] = useState('')
  const [customer, setCustomer] = useState(record.client?.id ?? '')
  const [contractSearch, setContractSearch] = useState('')
  const [contract, setContract] = useState(record.contract?.id ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [feedback, setFeedback] = useState('')
  const advisors = useApiData(loadAdvisors)
  const customerQuery = customerSearch.trim()
  const loadCustomers = useCallback((signal: AbortSignal) => customerQuery.length >= 2
    ? api.clientOptions(new URLSearchParams({ q: customerQuery, provisional: 'false' }).toString(), signal)
    : Promise.resolve(undefined), [customerQuery])
  const customers = useApiData(loadCustomers)
  const contractQuery = contractSearch.trim()
  const loadContracts = useCallback((signal: AbortSignal) => {
    if (!customer || (customer === record.client?.id && record.client.archivedAt)) return Promise.resolve(undefined)
    const params = new URLSearchParams({ clientId: customer })
    if (contractQuery.length >= 2) params.set('q', contractQuery)
    return api.contractOptions(record.id, params.toString(), signal)
  }, [record.id, record.client, customer, contractQuery])
  const contracts = useApiData(loadContracts)
  const [picked, setPicked] = useState(record.client)
  const [pickedContract, setPickedContract] = useState(record.contract)
  const shownCustomers = [picked, ...(customers.data?.data ?? [])].filter((item, index, all) => item && all.findIndex(other => other?.id === item.id) === index)
  const shownContracts = [pickedContract, ...(contracts.loading ? [] : contracts.data?.data ?? [])].filter((item, index, all) => item && all.findIndex(other => other?.id === item.id) === index)

  async function submit(event: FormEvent<HTMLFormElement>, addNote = false) {
    event.preventDefault()
    if (state.status !== 'authenticated' || busy) return
    const values = new FormData(event.currentTarget)
    const token = state.user.csrfToken
    setBusy(true)
    setFailure('')
    setFeedback('')
    try {
      if (addNote) {
        save(await api.addAssistanceNote(record.id, { version: record.version, body: note.trim() }, token))
        setNote('')
      } else {
        const status = String(values.get('status')) as AssistanceStatus
        const priority = String(values.get('priority')) as AssistancePatch['priority']
        const assignee = String(values.get('assignee') ?? '') || null
        const changes: AssistancePatch = {
          version: record.version, status: status !== record.status ? status : undefined,
          priority: priority !== record.priority ? priority : undefined,
          assignedTo: assignee !== record.assignedTo ? assignee : undefined,
          clientId: customer !== (record.client?.id ?? '') ? customer || null : undefined,
          contractId: contract !== (record.contract?.id ?? '') ? contract || null : undefined,
        }
        if (Object.values(changes).filter(value => value !== undefined).length === 1) {
          setFeedback('Aucune modification à enregistrer.')
          return
        }
        save(await api.updateAssistance(record.id, changes, token))
      }
      setFeedback('Dossier d’assistance mis à jour.')
    } catch (failure) {
      setFailure(businessError(failure))
    } finally { setBusy(false) }
  }

  return (
    <section className="panel grid min-w-0 content-start gap-4 p-4 sm:p-5" aria-label="Détail de la demande d’assistance">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold wrap-anywhere">{record.reference}</h2><RecordStatus status={record.status} /></div>
      <Facts items={[
        ['Demandeur', record.fullName], ['Téléphone', <a className="text-link" href={`tel:${record.phone}`}>{record.phone}</a>],
        ['Date', activityDate(record.createdAt)], ['Assurance', record.productTitle],
        ['Référence déclarée', record.contractReference || '—'],
        ['Notice lue', `${record.noticeVersion} · ${activityDate(record.acknowledgedAt)}`],
        ['Client lié', record.client ? <Link className="text-link" to={`/admin/clients/${record.client.id}`}>{record.client.displayName}</Link> : '—'],
        ['Contrat lié', record.contract ? <span className="flex flex-wrap items-center gap-2">
          <Link className="text-link" to={`/admin/contrats/${record.contract.id}`}>{record.contract.reference}</Link>
          <RecordStatus status={record.contract.status} />
        </span> : '—'],
      ]} />
      {record.contract && <p className="text-sm text-muted">Le statut enregistré ne confirme pas l’admissibilité de cette demande d’assistance.</p>}
      <p className="rounded bg-background p-3 leading-7 whitespace-pre-wrap wrap-anywhere text-muted">{record.description}</p>
      <form className="grid gap-3" onSubmit={event => { void submit(event) }} key={record.version}>
        <h3 className="font-semibold">Traitement du dossier</h3>
        <Select label="Statut du dossier" name="status" options={statusOptions([record.status, ...record.allowedStatuses])} defaultValue={record.status} />
        <Select label="Priorité du dossier" name="priority" options={priorities} defaultValue={record.priority} />
        <Select label="Conseiller assigné" name="assignee" placeholder="Non assigné" defaultValue={record.assignedTo ?? ''} options={[
          ...(record.assignee ? [record.assignee] : []), ...(advisors.data?.data ?? []).filter(item => item.id !== record.assignedTo),
        ].map(item => ({ value: item.id, label: item.displayName }))} />
        <Input label="Rechercher un client vérifié" maxLength={100} value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} hint="Confirmez l’identité du demandeur avant de lier sa fiche." />
        {customers.error && <ErrorState>La recherche de clients est indisponible.</ErrorState>}
        <Select label="Client lié" value={customer} placeholder="Aucun client lié" options={shownCustomers.flatMap(item => item ? [{ value: item.id, label: item.displayName }] : [])}
          onChange={event => {
            const id = event.target.value
            setCustomer(id)
            setPicked(shownCustomers.find(item => item?.id === id) ?? null)
            setContract('')
            setPickedContract(null)
            setContractSearch('')
          }} />
        {customer && <>
          <Input label="Rechercher une référence de contrat" value={contractSearch} maxLength={100} onChange={event => setContractSearch(event.target.value)} />
          {contracts.error && <ErrorState>{businessError(contracts.error)}</ErrorState>}
          <Select label="Contrat lié" value={contract} placeholder="Aucun contrat lié" options={shownContracts.flatMap(item => item ? [{ value: item.id, label: item.reference }] : [])}
            onChange={event => {
              setContract(event.target.value)
              setPickedContract(shownContracts.find(item => item?.id === event.target.value) ?? null)
            }} />
          {!contracts.loading && !contracts.error && !shownContracts.length && <p className="text-sm text-muted">Aucun contrat correspondant.</p>}
        </>}
        <div><Button type="submit" disabled={busy || Boolean(advisors.error && !record.assignee)}>Enregistrer le dossier</Button></div>
      </form>
      <form className="grid gap-3 border-t border-line pt-4" onSubmit={event => { void submit(event, true) }}>
        <Textarea label="Note interne" required maxLength={1000} value={note} onChange={event => setNote(event.target.value)} hint="Limitez la note aux informations nécessaires au suivi." />
        <div><Button type="submit" variant="secondary" disabled={busy || !note.trim()}>Ajouter la note</Button></div>
      </form>
      {record.notes.length > 0 && <ul className="grid gap-2 text-sm">{record.notes.map(item => <li key={item.id} className="rounded bg-background p-3 wrap-anywhere"><p className="font-semibold">{item.authorName} · {activityDate(item.createdAt)}</p><p className="whitespace-pre-wrap">{item.body}</p></li>)}</ul>}
      <h3 className="font-semibold">Historique du dossier</h3>
      <ActivityList activity={record.activity} />
      {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
      {failure && <ErrorState>{failure} <Button variant="secondary" onClick={reload}>Recharger le dossier</Button></ErrorState>}
    </section>
  )
}
