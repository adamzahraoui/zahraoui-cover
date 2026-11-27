import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/States'

export type Column<Row> = { title: string; render: (row: Row) => ReactNode }

type Props<Row> = {
  rows: Row[]
  columns: Column<Row>[]
  label: string
  pageSize?: number
}

export function RecordList<Row extends { id: string }>({ rows, columns, label, pageSize = 5 }: Props<Row>) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * pageSize, current * pageSize)

  if (rows.length === 0) return <EmptyState>Aucun résultat.</EmptyState>

  return (
    <section className="grid gap-3" aria-label={label}>
      <div className="panel hidden overflow-hidden xl:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="border-b border-line bg-background text-muted">
            <tr>{columns.map(column => <th key={column.title} scope="col" className="wrap-anywhere px-4 py-3 font-semibold">{column.title}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map(row => <tr key={row.id} className="hover:bg-background">{columns.map(column => <td key={column.title} className="wrap-anywhere px-4 py-3.5">{column.render(row)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {visible.map(row => (
          <li key={row.id} className="panel p-4">
            <dl className="grid gap-x-3 gap-y-2 text-sm sm:grid-cols-2">
              {columns.map(column => <div key={column.title} className="min-w-0"><dt className="text-muted">{column.title}</dt><dd className="mt-0.5 wrap-anywhere font-medium">{column.render(row)}</dd></div>)}
            </dl>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <p role="status">{rows.length} résultat{rows.length !== 1 ? 's' : ''} · Page {current} sur {pages}</p>
        {pages > 1 && (
          <div className="flex gap-2">
            <Button variant="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Précédent</Button>
            <Button variant="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Suivant</Button>
          </div>
        )}
      </div>
    </section>
  )
}
