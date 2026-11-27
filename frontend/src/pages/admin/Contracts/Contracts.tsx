import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminHeading, RecordStatus } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { ActionLink } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import type { DemoContract } from '../../../data/demo'
import { clientName, dateLabel, productName, statusOptions } from '../../../utils/admin'
import { searchable } from '../../../utils/forms'

export default function Contracts() {
  const { data } = useDemoData()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const client = params.get('clientId')
  const rows = data.contracts.filter(row => (!status || row.status === status) && (!client || row.clientId === client)
    && (!from || row.endOn >= from) && (!to || row.endOn <= to)
    && searchable(`${row.reference} ${clientName(data.clients, row.clientId)}`).includes(searchable(query)),
  )
  const columns: Column<DemoContract>[] = [
    { title: 'Référence', render: row => <Link className="text-link" to={`/admin/contrats/${row.id}`}>{row.reference}</Link> },
    { title: 'Client', render: row => clientName(data.clients, row.clientId) },
    { title: 'Catégorie', render: row => productName(row.product) },
    { title: 'Compagnie', render: row => data.partners.find(partner => partner.id === row.partnerId)?.name ?? '—' },
    { title: 'Échéance', render: row => dateLabel(row.endOn) },
    { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
  ]

  return (
    <>
      <AdminHeading title="Contrats" action={<ActionLink to="/admin/contrats/nouveau"><Plus size={16} aria-hidden /> Nouveau contrat</ActionLink>} />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Input label="Rechercher un contrat" type="search" placeholder="Référence ou client" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} />
        <Select label="Statut" value={status} placeholder="Tous les statuts" options={statusOptions(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED'])} onChange={event => setStatus(event.target.value)} />
        <Input label="Échéance à partir du" type="date" value={from} onChange={event => setFrom(event.target.value)} />
        <Input label="Échéance jusqu’au" type="date" value={to} onChange={event => setTo(event.target.value)} />
      </div>
      {from && to && from > to ? <ErrorState>Choisissez une période d’échéance valide.</ErrorState>
        : <RecordList key={JSON.stringify([query, status, from, to, client])} rows={rows} columns={columns} label="Liste des contrats" />}
    </>
  )
}
