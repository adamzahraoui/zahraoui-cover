import { Link } from 'react-router-dom'
import type { PageMeta, RequestRow } from '../../types/api'
import type { DemoRequest } from '../../data/demo'
import { productName } from '../../utils/admin'
import { RecordStatus } from './AdminContent'
import { RecordList } from './RecordList'
import type { Column } from './RecordList'

const columns: Column<RequestRow>[] = [
  { title: 'Référence', render: row => <Link className="text-link" to={`/admin/demandes/${row.id}`}>{row.reference}</Link> },
  { title: 'Client', render: row => row.displayName },
  { title: 'Assurance', render: row => productName(row.productSlug) },
  { title: 'Téléphone', render: row => row.phone },
  { title: 'Date', render: row => new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeZone: 'Africa/Casablanca' }).format(new Date(row.createdAt)) },
  { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
]

export function RequestList({ rows, label, pagination }: {
  rows: RequestRow[]; label: string; pagination?: PageMeta & { onPageChange: (page: number) => void }
}) {
  return <RecordList rows={rows} columns={columns} label={label} pagination={pagination} />
}

export function DemoRequestList({ rows }: { rows: DemoRequest[] }) {
  return <RecordList rows={rows} label="Demandes de démonstration" columns={[
    { title: 'Référence', render: row => row.reference },
    { title: 'Assurance', render: row => productName(row.product) },
    { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
  ]} />
}
