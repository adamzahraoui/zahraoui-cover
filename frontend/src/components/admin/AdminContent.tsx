import type { ReactNode } from 'react'
import { Check, Info } from 'lucide-react'
import { ActionLink } from '../ui/Button'
import { Breadcrumb } from '../ui/Breadcrumb'
import { EmptyState } from '../ui/States'
import { StatusBadge } from '../ui/StatusBadge'
import { statuses } from '../../utils/admin'

export function AdminHeading({ title, parent, action }: {
  title: string; parent?: { label: string; to: string }; action?: ReactNode
}) {
  const trail = parent ? [parent, { label: title }] : [{ label: title }]
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid min-w-0 gap-1.5">
        {parent && <Breadcrumb items={trail} />}
        <h1 className="text-2xl/8 font-bold wrap-anywhere text-ink lg:text-[30px]/[38px]">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function RecordStatus({ status }: { status: keyof typeof statuses }) {
  return <StatusBadge {...statuses[status]} />
}

export function Facts({ items }: { items: ReadonlyArray<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="mt-0.5 font-medium wrap-anywhere">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function NoRecord({ title, back }: { title: string; back: string }) {
  return <><AdminHeading title={title} /><EmptyState><p>Ce dossier est introuvable ou indisponible.</p><ActionLink to={back} variant="secondary">Retour à la liste</ActionLink></EmptyState></>
}

export function LocalFeedback({ children }: { children: ReactNode }) {
  return <p role="status" className="flex items-start gap-2 rounded border border-blue-200 bg-primary-tint p-3 text-sm leading-6 text-primary"><Check size={17} className="mt-0.5 shrink-0" aria-hidden />{children}</p>
}

export function DemoNote({ children }: { children: ReactNode }) {
  return <p className="flex items-start gap-2 rounded bg-background p-3 text-sm leading-6 text-muted"><Info size={17} className="mt-0.5 shrink-0" aria-hidden />{children}</p>
}
