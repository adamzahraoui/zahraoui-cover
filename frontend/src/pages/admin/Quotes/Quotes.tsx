import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminHeading, RecordStatus } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { ActionLink } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import type { DemoQuote } from '../../../data/demo'
import { clientName, moneyLabel, productName, statusOptions } from '../../../utils/admin'
import { searchable } from '../../../utils/forms'

export default function Quotes() {
  const { data } = useDemoData()
  const [params] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [query, setQuery] = useState('')
  const client = params.get('clientId')
  const request = params.get('requestId')
  const rows = data.quotes.filter(row => (!status || row.status === status) && (!client || row.clientId === client)
    && (!request || row.requestId === request) && searchable(`${row.reference} ${clientName(data.clients, row.clientId)}`).includes(searchable(query)),
  )
  const columns: Column<DemoQuote>[] = [
    { title: 'Référence', render: row => <Link className="text-link" to={`/admin/devis/${row.id}`}>{row.reference}</Link> },
    { title: 'Client', render: row => clientName(data.clients, row.clientId) },
    { title: 'Produit', render: row => productName(row.product) },
    { title: 'Montant estimé', render: row => moneyLabel(row.premium) },
    { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
  ]
  return (
    <>
      <AdminHeading title="Devis" action={<ActionLink to="/admin/devis/nouveau"><Plus size={16} aria-hidden /> Nouveau devis</ActionLink>} />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2">
        <Input label="Rechercher un devis" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder="Référence ou client" />
        <Select label="Statut" value={status} placeholder="Tous les statuts" options={statusOptions(['DRAFT', 'ISSUED', 'ACCEPTED', 'DECLINED'])} onChange={event => setStatus(event.target.value)} />
      </div>
      <RecordList key={JSON.stringify([query, status, client, request])} rows={rows} columns={columns} label="Liste des devis" />
    </>
  )
}
