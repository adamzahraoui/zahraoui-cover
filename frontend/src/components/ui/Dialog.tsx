import { X } from 'lucide-react'
import { useId } from 'react'
import type { ReactNode, RefObject } from 'react'

export function Dialog({ dialogRef, title, children }: {
  dialogRef: RefObject<HTMLDialogElement | null>; title: string; children: ReactNode
}) {
  const titleId = useId()
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-md border border-line bg-white p-5 text-ink shadow-xl sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-xl font-bold text-primary">{title}</h2>
        <button type="button" aria-label="Fermer" className="-mt-2 -mr-2 rounded p-2 text-muted hover:bg-background" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
      </div>
      {children}
    </dialog>
  )
}
