import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { DemoSupportCase } from '../../data/demo'
import type { AssistanceStatus, MessageStatus } from '../../types/api'
import { dateLabel, productName, statusOptions } from '../../utils/admin'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/Fields'
import { EmptyState } from '../ui/States'
import { StatusBadge } from '../ui/StatusBadge'
import { AdminHeading, Facts, LocalFeedback, RecordStatus } from './AdminContent'
import { useDemoData } from './DemoData'
import { RecordList } from './RecordList'
import type { Column } from './RecordList'

function CaseDetails({ record, onSelect }: { record: DemoSupportCase; onSelect: (id: string) => void }) {
  const { setData } = useDemoData()
  const [saved, setSaved] = useState(false)

  function update(updated: DemoSupportCase) {
    setData(previous => ({ ...previous, support: previous.support.map(row => row.id === updated.id ? updated : row) }))
    onSelect(updated.id)
    setSaved(true)
  }

  const assistance = record.kind === 'assistance'
  const nextStatus = assistance
    ? record.status === 'NEW' ? ['IN_PROGRESS', 'RESOLVED'] as const : record.status === 'IN_PROGRESS' ? ['RESOLVED'] as const : []
    : record.status === 'UNREAD' ? ['READ', 'PROCESSED'] as const : record.status === 'READ' ? ['PROCESSED'] as const : []

  return (
    <section className="panel grid min-w-0 content-start gap-4 p-4 sm:p-5" aria-label="Détail du dossier">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{record.reference}</h2><RecordStatus status={record.status} /></div>
      <Facts items={[
        ['Demandeur', record.name], ['Date', dateLabel(record.date)],
        ...(assistance ? [['Assurance', productName(record.product)], ['Référence contrat', record.contractReference ?? '—']] as [string, string][] : [['Objet', record.subject]] as [string, string][]),
      ]} />
      <p className="rounded bg-background p-3 leading-7 text-muted">{record.body}</p>
      {assistance && <Select label="Priorité" options={[{ value: 'NORMAL', label: 'Normale' }, { value: 'URGENT', label: 'Urgente' }]} value={record.priority} onChange={event => update({ ...record, priority: event.target.value === 'URGENT' ? 'URGENT' : 'NORMAL' })} />}
      {nextStatus.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statusOptions(nextStatus).map(({ value, label }) => <Button variant="secondary" key={value} onClick={() => {
            if (record.kind === 'assistance') update({ ...record, status: value as AssistanceStatus })
            else update({ ...record, status: value as MessageStatus })
          }}>{label} · démo</Button>)}
        </div>
      )}
      {saved && <LocalFeedback>Dossier mis à jour localement.</LocalFeedback>}
    </section>
  )
}

export function SupportInbox({ kind }: { kind: DemoSupportCase['kind'] }) {
  const { data } = useDemoData()
  const [query, setQuery] = useSearchParams()
  const [reference, setReference] = useState(query.get('reference') ?? '')
  const [status, setStatus] = useState(query.get('status') ?? '')
  const [priority, setPriority] = useState('')
  const assistance = kind === 'assistance'
  const title = assistance ? 'Demandes d’assistance' : 'Messages reçus'
  const rows = data.support.filter(row => row.kind === kind
    && (!reference.trim() || row.reference.toLocaleLowerCase('fr') === reference.trim().toLocaleLowerCase('fr'))
    && (!status || row.status === status)
    && (!priority || (row.kind === 'assistance' && row.priority === priority)),
  )
  const id = query.get('dossier')
  const record = rows.find(row => row.id === id) ?? data.support.find(row => row.kind === kind && row.id === id) ?? rows[0]
  function selectRecord(id: string) {
    if (query.get('dossier') === id) return
    const next = new URLSearchParams(query)
    next.set('dossier', id)
    setQuery(next, { replace: true })
  }

  const columns: Column<DemoSupportCase>[] = [
    { title: 'Référence', render: row => <button type="button" className="text-link text-left" aria-pressed={row.id === record?.id} onClick={() => selectRecord(row.id)}>{row.reference}</button> },
    { title: 'Demandeur', render: row => row.name },
    { title: assistance ? 'Priorité' : 'Objet', render: row => row.kind === 'assistance' ? <StatusBadge label={row.priority === 'URGENT' ? 'Urgente' : 'Normale'} tone={row.priority === 'URGENT' ? 'danger' : 'neutral'} /> : row.subject },
    { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
  ]

  return (
    <>
      <AdminHeading title={title} action={<Link className="text-link text-sm" to={assistance ? '/admin/messages' : '/admin/assistance'}>{assistance ? 'Voir les messages' : 'Voir les demandes d’assistance'}</Link>} />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Référence exacte" type="search" value={reference} onChange={event => setReference(event.target.value)} maxLength={32} />
        <Select label="Statut" placeholder="Tous les statuts" options={statusOptions(assistance ? ['NEW', 'IN_PROGRESS', 'RESOLVED'] : ['UNREAD', 'READ', 'PROCESSED'])} value={status} onChange={event => setStatus(event.target.value)} />
        {assistance && <Select label="Priorité" placeholder="Toutes les priorités" options={[{ value: 'NORMAL', label: 'Normale' }, { value: 'URGENT', label: 'Urgente' }]} value={priority} onChange={event => setPriority(event.target.value)} />}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <RecordList key={JSON.stringify([reference, status, priority])} rows={rows} columns={columns} label={title} />
        {record ? <CaseDetails key={record.id} record={record} onSelect={selectRecord} /> : <EmptyState>Sélectionnez un dossier pour afficher son détail.</EmptyState>}
      </div>
    </>
  )
}
