import { Handshake, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AdminHeading, DemoNote, LocalFeedback } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/Dialog'
import { Input } from '../../../components/ui/Fields'
import { EmptyState } from '../../../components/ui/States'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { DemoPartner } from '../../../data/demo'
import { searchable } from '../../../utils/forms'

export default function Partners() {
  const { data, setData } = useDemoData()
  const dialog = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<DemoPartner>()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function open(record?: DemoPartner) {
    dialog.current?.querySelector('form')?.reset()
    setEditing(record)
    setError('')
    setSaved(false)
    dialog.current?.showModal()
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const name = String(values.get('name') ?? '').trim()
    if (name.length < 2 || data.partners.some(row => row.id !== editing?.id && searchable(row.name) === searchable(name))) {
      setError(name.length < 2 ? 'Saisissez un libellé de test.' : 'Ce libellé existe déjà dans la démonstration.')
      return
    }
    const updated: DemoPartner = { id: editing?.id ?? crypto.randomUUID(), name, active: values.has('active') }
    setData(previous => ({
      ...previous,
      partners: editing ? previous.partners.map(row => row.id === editing.id ? updated : row) : [...previous.partners, updated],
    }))
    setSaved(true)
    dialog.current?.close()
  }

  return (
    <>
      <AdminHeading title="Compagnies partenaires" action={<Button onClick={() => open()}><Plus size={17} aria-hidden /> Ajouter un exemple</Button>} />
      <DemoNote>Aucun partenaire officiel n’est renseigné. Les libellés ajoutés ici restent des exemples locaux.</DemoNote>
      {saved && <LocalFeedback>Exemple partenaire modifié dans la démonstration.</LocalFeedback>}
      {data.partners.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.partners.map(row => (
            <article key={row.id} className="panel grid justify-items-start gap-3 p-4">
              <Handshake size={23} className="text-primary" aria-hidden />
              <h2 className="font-semibold">{row.name}</h2>
              <StatusBadge label={row.active ? 'Exemple actif' : 'Exemple inactif'} tone={row.active ? 'success' : 'neutral'} />
              <Button variant="secondary" aria-label={`Modifier : ${row.name}`} onClick={() => open(row)}>Modifier</Button>
            </article>
          ))}
        </div>
      ) : <EmptyState>Aucun exemple partenaire.</EmptyState>}
      <Dialog title={editing ? 'Modifier l’exemple partenaire' : 'Ajouter un exemple partenaire'} dialogRef={dialog}>
        <form key={editing?.id ?? 'new'} className="grid gap-4" onSubmit={save}>
          <Input label="Libellé fictif" name="name" defaultValue={editing?.name} required minLength={2} maxLength={120} error={error} onChange={() => setError('')} />
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="active" className="size-4 accent-primary" defaultChecked={editing?.active ?? true} /> Exemple actif</label>
          <Button type="submit">Appliquer à la démonstration</Button>
        </form>
      </Dialog>
    </>
  )
}
