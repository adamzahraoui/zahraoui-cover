import { Link } from 'react-router-dom'
import type { ContractRow, PageMeta } from '../../types/api'
import { dateLabel } from '../../utils/admin'
import { RecordStatus } from './AdminContent'
import { RecordList } from './RecordList'
import type { Column } from './RecordList'

const columns: Column<ContractRow>[] = [
  { title: 'Référence', render: row => <Link className="text-link" to={`/admin/contrats/${row.id}`}>{row.reference}</Link> },
  { title: 'Client', render: row => row.clientName },
  { title: 'Catégorie', render: row => row.productTitle },
  { title: 'Compagnie', render: row => row.partnerName },
  { title: 'Période', render: row => <>{dateLabel(row.effectiveOn)}<br />{dateLabel(row.expiresOn)}</> },
  { title: 'Devis source', render: row => row.quoteId && row.quoteReference ? <Link className="text-link" to={`/admin/devis/${row.quoteId}`}>{row.quoteReference}</Link> : '—' },
  { title: 'Statut', render: row => <div className="grid justify-items-start gap-1"><RecordStatus status={row.status} />{row.renewed && <span className="text-xs text-muted">Successeur confirmé</span>}</div> },
]

export function ContractList({ rows, label, pagination }: {
  rows: ContractRow[]; label: string; pagination?: PageMeta & { onPageChange: (page: number) => void }
}) {
  return <RecordList rows={rows} label={label} columns={columns} pagination={pagination} />
}
