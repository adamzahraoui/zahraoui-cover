import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingState() {
  return <p role="status" className="panel flex items-center gap-2 p-5 text-muted"><LoaderCircle size={18} className="motion-safe:animate-spin" /> Chargement…</p>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="panel grid justify-items-center gap-3 px-4 py-9 text-center text-muted"><Inbox aria-hidden className="text-secondary" />{children}</div>
}

export function ErrorState({ children }: { children: ReactNode }) {
  return <div role="alert" className="flex items-start gap-2.5 rounded border border-red-200 bg-red-50 p-4 text-sm text-danger"><AlertCircle size={18} className="shrink-0" aria-hidden /><div>{children}</div></div>
}
