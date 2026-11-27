import { Link } from 'react-router-dom'
import type { InputHTMLAttributes } from 'react'

export function NoticeCheckbox(props: Pick<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange'>) {
  return (
    <div className="rounded border border-line bg-background p-4 text-sm leading-6">
      <label className="flex items-start gap-3">
        <input type="checkbox" required name="acknowledged" className="mt-1 size-4 shrink-0 accent-primary" {...props} />
        <span>J’ai lu les informations de confidentialité de ce formulaire. *</span>
      </label>
      <Link to="/politique-de-confidentialite" target="_blank" rel="noopener" className="text-link ml-7">Lire la politique de confidentialité (nouvel onglet)</Link>
    </div>
  )
}
