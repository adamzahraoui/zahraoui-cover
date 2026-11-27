import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AdminHeading, DemoNote, LocalFeedback } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Textarea } from '../../../components/ui/Fields'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { CatalogItem } from '../../../data/demo'
import { getInsurance } from '../../../data/insurance'

export default function InsuranceManagement() {
  const { data, setData } = useDemoData()
  const dialog = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<CatalogItem>()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function open(item: CatalogItem) {
    setEditing(item)
    setError('')
    setSaved(false)
    dialog.current?.showModal()
  }

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const values = new FormData(event.currentTarget)
    const summary = String(values.get('summary') ?? '').trim()
    if (summary.length < 10) {
      setError('Rédigez au moins dix caractères utiles.')
      return
    }
    setData(previous => ({
      ...previous,
      catalog: previous.catalog.map(row => row.slug === editing.slug ? { ...row, summary, published: values.has('published') } : row),
    }))
    setSaved(true)
    dialog.current?.close()
  }

  return (
    <>
      <AdminHeading title="Catalogue des assurances" />
      <DemoNote>Les six catégories du catalogue sont réservées. Les modifications de cette démonstration ne changent pas le site public.</DemoNote>
      {saved && <LocalFeedback>Produit modifié dans la démonstration.</LocalFeedback>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.catalog.map(item => {
          const product = getInsurance(item.slug)
          const Icon = product.icon
          return (
            <article className="panel flex flex-col items-start gap-3 p-4 sm:p-5" key={item.slug}>
              <div className="flex w-full items-start justify-between gap-2"><Icon size={24} className="shrink-0 text-primary" aria-hidden /><StatusBadge label={item.published ? 'Visible (démo)' : 'Masqué (démo)'} tone={item.published ? 'success' : 'neutral'} /></div>
              <h2 className="font-semibold">{product.label}</h2>
              <p className="mb-2 flex-1 text-sm leading-6 text-muted">{item.summary}</p>
              <Button variant="secondary" aria-label={`Modifier : ${product.label}`} onClick={() => open(item)}>Modifier</Button>
            </article>
          )
        })}
      </div>
      <Dialog title={editing ? getInsurance(editing.slug).label : 'Modifier le produit'} dialogRef={dialog}>
        {editing && (
          <form key={`${editing.slug}:${editing.summary}:${editing.published}`} className="grid gap-4" onSubmit={update}>
            <Textarea label="Résumé du produit" name="summary" required minLength={10} maxLength={300} defaultValue={editing.summary} error={error} onChange={() => setError('')} />
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="published" className="size-4 accent-primary" defaultChecked={editing.published} /> Visible dans le catalogue démo</label>
            <Button type="submit">Appliquer à la démonstration</Button>
          </form>
        )}
      </Dialog>
    </>
  )
}
