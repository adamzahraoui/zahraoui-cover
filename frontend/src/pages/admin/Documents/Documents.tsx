import { Plus } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ActivityList, activityDate } from '../../../components/admin/ActivityList'
import { AdminHeading, Facts, LocalFeedback } from '../../../components/admin/AdminContent'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { DocumentDetail, DocumentRow } from '../../../types/api'
import { categories, UploadDocument } from './UploadDocument'

const statusOptions = [{ value: 'READY', label: 'Prêt' }, { value: 'QUEUED', label: 'En attente' }, { value: 'FAILED', label: 'Échec' }]
const archiveOptions = [{ value: 'false', label: 'Courants' }, { value: 'true', label: 'Archivés' }, { value: 'all', label: 'Tous les documents' }]
const numberLabel = new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 1 })

function sizeLabel(value: string | null) {
  if (value === null) return '—'
  const bytes = Number(value)
  if (bytes >= 1024 ** 3) return numberLabel.format(bytes / 1024 ** 3) + ' Gio'
  if (bytes >= 1024 ** 2) return numberLabel.format(bytes / 1024 ** 2) + ' Mio'
  if (bytes >= 1024) return numberLabel.format(bytes / 1024) + ' Kio'
  return numberLabel.format(bytes) + ' o'
}

function categoryLabel(row: DocumentRow) {
  return categories.find(category => category.value === row.kind)?.label
}

function documentStatus(row: DocumentRow) {
  if (row.archivedAt) return 'Archivé'
  return statusOptions.find(option => option.value === row.status)?.label ?? '—'
}

function DocumentLinks({ row }: { row: DocumentRow }) {
  const href = '/api/admin/documents/' + encodeURIComponent(row.id) + '/download'
  return <div className="flex flex-wrap gap-x-3 gap-y-2">
    {row.canPreview && <a className="text-link" href={href + '?inline=true'} target="_blank" rel="noopener">Aperçu PDF</a>}
    {row.status === 'READY' && <a className="text-link" href={href} download>Télécharger</a>}
  </div>
}

function RelatedRecord({ row }: { row: DocumentRow }) {
  return <div className="grid gap-1">
    {row.client && <Link className="text-link" to={'/admin/clients/' + row.client.id}>{row.client.displayName}</Link>}
    {row.quote && <Link className="text-link" to={'/admin/devis/' + row.quote.id}>{row.quote.reference}</Link>}
    {row.contract && <Link className="text-link" to={'/admin/contrats/' + row.contract.id}>{row.contract.reference}</Link>}
  </div>
}

export default function Documents() {
  const { state } = useAdminSession()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState('')
  const [uploadKey, setUploadKey] = useState(0)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [busy, setBusy] = useState(false)
  const detailDialog = useRef<HTMLDialogElement>(null)
  const uploadDialog = useRef<HTMLDialogElement>(null)
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const invalid = Boolean(from && to && from > to)
  const clientId = params.get('clientId') ?? undefined
  const contractId = params.get('contractId') ?? undefined
  const quoteId = params.get('quoteId') ?? undefined
  const filter = new URLSearchParams({ limit: '10' })
  for (const name of ['kind', 'status', 'archived', 'from', 'to', 'clientId', 'quoteId', 'contractId', 'page']) {
    const value = params.get(name)
    if (value) filter.set(name, value)
  }
  if (search.trim().length >= 2) filter.set('q', search.trim())
  const query = filter.toString()
  const load = useCallback((signal: AbortSignal) => invalid ? Promise.resolve(undefined) : api.documents(query, signal), [invalid, query])
  const loadDetail = useCallback((signal: AbortSignal) => selected ? api.document(selected, signal) : Promise.resolve(undefined), [selected])
  const list = useApiData(load)
  const detail = useApiData(loadDetail)
  const record = detail.data?.id === selected ? detail.data : undefined

  function change(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (name !== 'page') next.delete('page')
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: name !== 'page' })
  }

  function show(id: string) {
    setSelected(id)
    setConfirmArchive(false)
    setMutationError('')
    detail.reload()
    detailDialog.current?.showModal()
  }

  function uploaded(document: DocumentDetail) {
    uploadDialog.current?.close()
    setFeedback('PDF déposé.')
    list.reload()
    show(document.id)
  }

  async function archive() {
    if (!record || busy || state.status !== 'authenticated' || state.user.role !== 'ADMIN') return
    setBusy(true)
    setMutationError('')
    try {
      detail.setData(await api.archiveDocument(record.id, record.version, state.user.csrfToken))
      setConfirmArchive(false)
      setFeedback('Document archivé.')
      list.reload()
      detailDialog.current?.close()
    } catch (error) {
      setMutationError(businessError(error))
      setConfirmArchive(false)
      detail.reload()
    } finally { setBusy(false) }
  }

  const columns: Column<DocumentRow>[] = [
    { title: 'Document', render: row => <button type="button" className="text-link text-left wrap-anywhere" onClick={() => show(row.id)}>{row.name}</button> },
    { title: 'Catégorie', render: categoryLabel },
    { title: 'Dossier associé', render: row => <RelatedRecord row={row} /> },
    { title: 'Date et taille', render: row => <>{activityDate(row.createdAt)}<br />{sizeLabel(row.sizeBytes)}</> },
    { title: 'Statut', render: row => <StatusBadge label={documentStatus(row)} tone={row.archivedAt ? 'neutral' : row.status === 'READY' ? 'success' : 'warning'} /> },
    { title: 'Actions', render: row => <DocumentLinks row={row} /> },
  ]

  return <>
    <AdminHeading title="Documents" action={list.data?.uploadEnabled && !quoteId &&
      <Button onClick={() => { setUploadKey(value => value + 1); uploadDialog.current?.showModal() }}><Plus size={16} aria-hidden /> Ajouter un PDF</Button>} />
    {list.data && <div className="panel p-4"><Facts items={[
      ['Documents enregistrés', numberLabel.format(list.data.storage.count)],
      ['Volume total enregistré', sizeLabel(list.data.storage.sizeBytes)],
    ]} /></div>}
    <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      <Input label="Rechercher un document" type="search" placeholder="Fichier, client, devis ou contrat" value={search} maxLength={100}
        onChange={event => { setSearch(event.target.value); if (params.has('page')) change('page', '') }} />
      <Select label="Catégorie" value={params.get('kind') ?? ''} placeholder="Toutes les catégories" options={[...categories]} onChange={event => change('kind', event.target.value)} />
      <Select label="Statut" value={params.get('status') ?? ''} placeholder="Tous les statuts" options={statusOptions} onChange={event => change('status', event.target.value)} />
      <Select label="Archivage" value={params.get('archived') ?? 'false'} options={archiveOptions} onChange={event => change('archived', event.target.value)} />
      <Input label="Date de début" type="date" value={from} onChange={event => change('from', event.target.value)} />
      <Input label="Date de fin" type="date" value={to} onChange={event => change('to', event.target.value)} error={invalid ? 'La date de fin doit suivre la date de début.' : undefined} />
      {(clientId || contractId || quoteId) && <div><ActionLink variant="secondary" to="/admin/documents">Afficher tous les dossiers</ActionLink></div>}
    </div>
    {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
    {list.loading && !invalid && <LoadingState />}
    {list.error && <ErrorState>{businessError(list.error)} <Button variant="secondary" onClick={list.reload}>Réessayer</Button></ErrorState>}
    {list.data && !invalid && <RecordList rows={list.data.data} label="Liste des documents" columns={columns}
      pagination={{ ...list.data.meta, onPageChange: page => change('page', String(page)) }} />}
    <Dialog title="Déposer un PDF" dialogRef={uploadDialog}>
      <UploadDocument key={uploadKey} clientId={clientId} contractId={contractId} onSaved={uploaded} />
    </Dialog>
    <Dialog title="Fiche du document" dialogRef={detailDialog}>
      {!record && detail.loading && <LoadingState />}
      {detail.error && <ErrorState>{businessError(detail.error)} <Button variant="secondary" onClick={detail.reload}>Réessayer</Button></ErrorState>}
      {record && <div className="grid gap-4">
        <p className="font-semibold wrap-anywhere">{record.name}</p>
        <Facts items={[
          ['Catégorie', categoryLabel(record)], ['Statut', documentStatus(record)], ['Taille', sizeLabel(record.sizeBytes)],
          ['Date de création', activityDate(record.createdAt)], ['Disponible le', record.readyAt && activityDate(record.readyAt)], ['Déposé par', record.uploader?.displayName],
          ['Révision', record.revision], ['Version figée du devis', record.quoteVersion],
          ['Archivé le', record.archivedAt ? activityDate(record.archivedAt) : undefined],
        ]} />
        <RelatedRecord row={record} />
        <DocumentLinks row={record} />
        {record.canArchive && state.status === 'authenticated' && state.user.role === 'ADMIN' && <div>
          {confirmArchive ? <div className="grid gap-2">
            <p className="text-sm">Le fichier restera accessible dans les archives.</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => { void archive() }}>Confirmer l’archivage</Button>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirmArchive(false)}>Annuler</Button>
            </div>
          </div> : <Button variant="secondary" onClick={() => setConfirmArchive(true)}>Archiver le document</Button>}
        </div>}
        {mutationError && <ErrorState>{mutationError}</ErrorState>}
        <h3 className="font-semibold">Historique du document</h3>
        <ActivityList activity={record.activity} />
      </div>}
    </Dialog>
  </>
}
