import { Handshake, Plus } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminHeading, LocalFeedback } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Input, Select } from '../../../components/ui/Fields'
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { productOptions } from '../../../data/insurance'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { PartnerDetail } from '../../../types/api'
import { PartnerEditor } from './PartnerEditor'

const statuses = [
  { value: 'UNVERIFIED', label: 'À vérifier' }, { value: 'VERIFIED', label: 'Vérifiées' },
  { value: 'ACTIVE', label: 'Actives' }, { value: 'INACTIVE', label: 'Inactives' }, { value: 'PUBLISHED', label: 'Publiées' },
]

export default function Partners() {
  const { state } = useAdminSession()
  const admin = state.status === 'authenticated' && state.user.role === 'ADMIN'
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState('')
  const [feedback, setFeedback] = useState('')
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const filters = new URLSearchParams({ limit: '9' })
  for (const key of ['status', 'page', 'productSlug']) if (params.get(key)) filters.set(key, params.get(key)!)
  if (query.trim().length >= 2) filters.set('q', query.trim())
  const search = filters.toString()
  const load = useCallback((signal: AbortSignal) => api.partners(search, signal), [search])
  const list = useApiData(load)
  const loadDetail = useCallback((signal: AbortSignal) => selected && selected !== 'new' ? api.partner(selected, signal) : Promise.resolve(undefined), [selected])
  const detail = useApiData(loadDetail)
  const record = detail.data?.id === selected ? detail.data : undefined

  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (key !== 'page') next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key !== 'page' })
  }

  function open(id: string) {
    setSelected(id)
    setFeedback('')
    detail.setData(undefined)
    detail.reload()
    dialog.current?.showModal()
  }

  function saved(updated: PartnerDetail, message: string) {
    detail.setData(updated)
    setSelected(updated.id)
    setFeedback(message)
    list.reload()
  }

  const meta = list.data?.meta
  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  return <>
    <AdminHeading title="Compagnies partenaires" action={admin && <Button onClick={() => open('new')}><Plus size={17} aria-hidden /> Ajouter une compagnie</Button>} />
    <div className="panel grid gap-3 p-4 sm:grid-cols-3">
      <Input label="Rechercher une compagnie" type="search" maxLength={100} value={query}
        onChange={event => { setQuery(event.target.value); if (params.has('page')) change('page', '') }} />
      <Select label="Statut" value={params.get('status') ?? ''} placeholder="Tous les statuts" options={statuses} onChange={event => change('status', event.target.value)} />
      <Select label="Catégorie" value={params.get('productSlug') ?? ''} placeholder="Toutes les assurances" options={productOptions} onChange={event => change('productSlug', event.target.value)} />
    </div>
    {feedback && <LocalFeedback>{feedback}</LocalFeedback>}
    {list.loading && <LoadingState />}
    {list.error && <ErrorState>{businessError(list.error)} <Button variant="secondary" onClick={list.reload}>Réessayer</Button></ErrorState>}
    {list.data?.data.length === 0 && <EmptyState>Aucune compagnie dans cette liste.</EmptyState>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.data?.data.map(row => <article key={row.id} className="panel grid min-w-0 justify-items-start gap-3 p-4">
        <Handshake size={23} className="text-primary" aria-hidden />
        <h2 className="font-semibold wrap-anywhere">{row.displayName ?? row.name}</h2>
        {row.displayName && <p className="text-sm text-muted wrap-anywhere">{row.name}</p>}
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={row.verifiedAt ? 'Vérifiée' : 'À vérifier'} tone={row.verifiedAt ? 'success' : 'warning'} />
          <StatusBadge label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'success' : 'neutral'} />
          {row.isPublished && <StatusBadge label="Publiée" tone="info" />}
        </div>
        <Button variant="secondary" aria-label={`Consulter : ${row.displayName ?? row.name}`} onClick={() => open(row.id)}>Consulter</Button>
      </article>)}
    </div>
    {meta && (pages > 1 || meta.page > 1) && <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted">Page {meta.page} sur {pages}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={meta.page <= 1} onClick={() => change('page', String(meta.page - 1))}>Précédent</Button>
        <Button variant="secondary" disabled={meta.page >= pages} onClick={() => change('page', String(meta.page + 1))}>Suivant</Button>
      </div>
    </div>}
    <Dialog title={record?.displayName ?? record?.name ?? (selected === 'new' ? 'Ajouter une compagnie' : 'Fiche partenaire')} dialogRef={dialog}>
      {feedback && <div className="mb-3"><LocalFeedback>{feedback}</LocalFeedback></div>}
      {selected !== 'new' && !record && detail.loading && <LoadingState />}
      {selected !== 'new' && detail.error && <ErrorState>{businessError(detail.error)} <Button variant="secondary" onClick={detail.reload}>Réessayer</Button></ErrorState>}
      {(selected === 'new' || record) && <PartnerEditor key={record ? `${record.id}:${record.version}` : 'new'} record={record} onSaved={saved} reload={detail.reload} />}
    </Dialog>
  </>
}
