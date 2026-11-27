import { useCallback, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { productOptions } from '../../data/insurance'
import { useApiData } from '../../hooks/useApiData'
import { AssistanceDetails, priorities } from '../../pages/admin/AssistanceInbox/AssistanceDetails'
import { MessageDetails } from '../../pages/admin/Messages/MessageDetails'
import { api, businessError } from '../../services/api'
import type { AssistanceCase, AssistanceRow, Message, MessageRow, Page } from '../../types/api'
import { statusOptions } from '../../utils/admin'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Fields'
import { EmptyState, ErrorState, LoadingState } from '../ui/States'
import { StatusBadge } from '../ui/StatusBadge'
import { AdminHeading, RecordStatus } from './AdminContent'
import { activityDate } from './ActivityList'
import { RecordList } from './RecordList'
import type { Column } from './RecordList'

type InboxRow = AssistanceRow | MessageRow

export function SupportInbox({ kind }: { kind: 'message' | 'assistance' }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('reference') ?? '')
  const detailPanel = useRef<HTMLDivElement>(null)
  const assistance = kind === 'assistance'
  const title = assistance ? 'Demandes d’assistance' : 'Messages reçus'
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const invalidDates = Boolean(from && to && from > to)
  const filters = new URLSearchParams({ limit: '10' })
  for (const key of ['status', 'page', 'from', 'to', ...(assistance ? ['priority', 'productSlug'] : ['archived'])]) {
    const value = params.get(key)
    if (value) filters.set(key, value)
  }
  if (search.trim().length >= 2) filters.set('q', search.trim())
  const query = filters.toString()
  const loadList = useCallback((signal: AbortSignal) => invalidDates
    ? Promise.resolve(undefined)
    : assistance ? api.assistanceCases(query, signal) : api.messages(query, signal), [assistance, invalidDates, query])
  const list = useApiData<Page<InboxRow> | undefined>(loadList)
  const id = params.get('id') ?? params.get('dossier') ?? list.data?.data[0]?.id
  const loadDetail = useCallback((signal: AbortSignal) => !id
    ? Promise.resolve(undefined)
    : assistance ? api.assistanceCase(id, signal) : api.message(id, signal), [assistance, id])
  const detail = useApiData<Message | AssistanceCase | undefined>(loadDetail)
  const record = detail.data?.id === id ? detail.data : undefined

  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (key !== 'page' && key !== 'id') next.delete('page')
    if (key === 'id') next.delete('dossier')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key !== 'id' && key !== 'page' })
  }

  function selectRecord(id: string) {
    change('id', id)
    if (window.matchMedia('(max-width: 1023px)').matches) requestAnimationFrame(() => detailPanel.current?.focus())
  }

  const columns: Column<InboxRow>[] = [
    { title: 'Référence', render: row => <button type="button" className="text-link text-left" aria-pressed={row.id === id} onClick={() => selectRecord(row.id)}>{row.reference}</button> },
    { title: 'Demandeur', render: row => row.fullName },
    { title: assistance ? 'Priorité' : 'Objet', render: row => 'priority' in row ? <StatusBadge label={row.priority === 'URGENT' ? 'Urgente' : 'Normale'} tone={row.priority === 'URGENT' ? 'danger' : 'neutral'} /> : row.subject },
    { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
    { title: 'Date', render: row => activityDate(row.createdAt) },
  ]

  function reloadDetail() {
    detail.setData(undefined)
    detail.reload()
  }

  return (
    <>
      <AdminHeading title={title} action={<Link className="text-link text-sm" to={assistance ? '/admin/messages' : '/admin/assistance'}>{assistance ? 'Voir les messages' : 'Voir les demandes d’assistance'}</Link>} />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Rechercher un dossier" type="search" placeholder={assistance ? 'Référence, nom ou téléphone' : 'Référence, nom ou objet'} value={search} onChange={event => { setSearch(event.target.value); if (params.has('page')) change('page', '') }} maxLength={100} />
        <Select label="Statut" placeholder="Tous les statuts" options={statusOptions(assistance ? ['NEW', 'IN_PROGRESS', 'RESOLVED'] : ['UNREAD', 'READ', 'PROCESSED'])} value={params.get('status') ?? ''} onChange={event => change('status', event.target.value)} />
        {assistance ? <>
          <Select label="Priorité" placeholder="Toutes les priorités" options={priorities} value={params.get('priority') ?? ''} onChange={event => change('priority', event.target.value)} />
          <Select label="Assurance" placeholder="Toutes les assurances" options={productOptions} value={params.get('productSlug') ?? ''} onChange={event => change('productSlug', event.target.value)} />
        </> : <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={params.get('archived') === 'true'} onChange={event => change('archived', event.target.checked ? 'true' : '')} className="size-4 accent-primary" /> Afficher les archives</label>}
        <Input label="Du" type="date" value={from} onChange={event => change('from', event.target.value)} />
        <Input label="Au" type="date" value={to} onChange={event => change('to', event.target.value)} error={invalidDates ? 'La date de fin doit suivre la date de début.' : undefined} />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid gap-3">
          {list.loading && !invalidDates && <LoadingState />}
          {list.error && <ErrorState>{businessError(list.error)} <Button variant="secondary" onClick={list.reload}>Réessayer</Button></ErrorState>}
          {list.data && !invalidDates && <RecordList rows={list.data.data} columns={columns} label={title} pagination={{ ...list.data.meta, onPageChange: page => change('page', String(page)) }} />}
        </div>
        <div ref={detailPanel} tabIndex={-1} className="min-w-0 focus:outline-none">
          {detail.loading && id && <LoadingState />}
          {detail.error && <ErrorState>{businessError(detail.error)} <Button variant="secondary" onClick={detail.reload}>Réessayer</Button></ErrorState>}
          {record && ('description' in record
            ? <AssistanceDetails key={record.id} record={record} reload={reloadDetail} save={saved => { detail.setData(saved); list.reload() }} />
            : <MessageDetails key={record.id} record={record} reload={reloadDetail} save={saved => { detail.setData(saved); list.reload() }} />)}
          {!id && !list.loading && <EmptyState>Sélectionnez un dossier pour afficher son détail.</EmptyState>}
        </div>
      </div>
    </>
  )
}
