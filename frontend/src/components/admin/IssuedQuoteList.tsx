import { Link } from 'react-router-dom'
import type { IssuedQuoteRow, PageMeta } from '../../types/api'
import { activityDate } from './ActivityList'
import { RecordStatus } from './AdminContent'
import { RecordList } from './RecordList'
import type { Column } from './RecordList'

export function quoteAmount(amount: string) {
  const [whole, fraction = '00'] = amount.split('.')
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + fraction + ' MAD'
}

const columns: Column<IssuedQuoteRow>[] = [
  { title: 'Référence', render: row => <Link className="text-link" to={`/admin/devis/${row.id}`}>{row.reference}</Link> },
  { title: 'Client', render: row => row.clientName },
  { title: 'Assurance', render: row => row.productTitle },
  { title: 'Total', render: row => quoteAmount(row.totalMad) },
  { title: 'Date', render: row => activityDate(row.issuedAt ?? row.createdAt) },
  { title: 'Statut', render: row => <RecordStatus status={row.status} /> },
]
export function IssuedQuoteList({ rows, label, pagination }: {
  rows: IssuedQuoteRow[]; label: string; pagination?: PageMeta & { onPageChange: (page: number) => void }
}) {
  return <RecordList rows={rows} columns={columns} label={label} pagination={pagination} />
}
