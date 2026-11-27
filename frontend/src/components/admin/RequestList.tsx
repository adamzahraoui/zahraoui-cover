import { Link } from 'react-router-dom'
import type { DemoRequest } from '../../data/demo'
import { dateLabel, productName } from '../../utils/admin'
import { RecordStatus } from './AdminContent'
import { RecordList } from './RecordList'
import type { Column } from './RecordList'

const columns: Column<DemoRequest>[] = [
  { title: 'Référence', render: row => <Link className="text-link" to={`/admin/demandes/${row.id}`}>{row.reference}</Link> },
  { title: 'Client', render: row => row.name },
  { title: 'Assurance', render: row => productName(row.product) },
  { title: 'Téléphone', render: row => row.phone },
  { title: 'Date', render: row => dateLabel(row.date) },
  { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
]

export function RequestList({ rows, label }: { rows: DemoRequest[]; label: string }) {
  return <RecordList rows={rows} columns={columns} label={label} />
}
