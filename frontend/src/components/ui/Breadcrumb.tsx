import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Breadcrumb({ items }: { items: ReadonlyArray<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Fil d’Ariane" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map(({ label, to }, index) => (
          <li key={label} className="inline-flex min-w-0 items-center gap-2 wrap-anywhere">
            {index > 0 && <ChevronRight size={14} className="shrink-0" aria-hidden />}
            {to ? <Link to={to} className="hover:underline">{label}</Link> : <span aria-current="page" className="min-w-0">{label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
