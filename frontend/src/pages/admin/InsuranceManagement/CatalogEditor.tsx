import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import type { ProductSlug } from '../../../config/navigation'
import type { CatalogItem, CatalogWrite, Profile } from '../../../types/api'
import { businessError } from '../../../services/api'

const lines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean)

function pairs(text: string) {
  return lines(text).map(line => {
    const separator = line.indexOf('|')
    return separator < 0 ? [line, ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
  })
}

export function CatalogEditor({ item, options, catalog, canEdit, onSave }: {
  item?: CatalogItem
  options: { value: ProductSlug; label: string }[]
  catalog: CatalogItem[]
  canEdit: boolean
  onSave: (values: CatalogWrite, slug: ProductSlug) => Promise<void>
}) {
  const [active, setActive] = useState(item?.isActive ?? true)
  const [published, setPublished] = useState(item?.isPublished ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || busy) return
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '')
    const slug = item?.slug ?? options.find(option => option.value === value('slug'))?.value
    if (!slug) { setError('Choisissez une catégorie réservée.'); return }
    const audiences = form.getAll('audience').filter((entry): entry is Profile => entry === 'INDIVIDUAL' || entry === 'BUSINESS')
    if (!audiences.length) { setError('Sélectionnez au moins un public.'); return }
    const relatedSlugs = catalog.filter(row => form.getAll('related').includes(row.slug)).map(row => row.slug)
    setBusy(true)
    setError('')
    try {
      await onSave({
        title: value('title'), summary: value('summary'), audiences,
        eligibilityText: value('eligibility'), documentHints: lines(value('documents')),
        potentialCoverages: pairs(value('coverages')).map(([title, description]) => ({ title, description })),
        faqs: pairs(value('faqs')).map(([question, answer]) => ({ question, answer })),
        relatedSlugs, displayOrder: Number(value('displayOrder')), isActive: active, isPublished: published && active,
      }, slug)
    } catch (failure) {
      setError(businessError(failure))
    } finally { setBusy(false) }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <fieldset disabled={!canEdit || busy} className="grid gap-4">
        {!item && <Select label="Catégorie réservée" name="slug" placeholder="Sélectionner" required options={options} />}
        {item && <p className="text-sm text-muted">Identifiant de catégorie · {item.slug}</p>}
        <Input label="Nom du produit" name="title" required minLength={2} maxLength={120} defaultValue={item?.title} />
        <Textarea label="Résumé du produit" name="summary" required minLength={10} maxLength={300} defaultValue={item?.summary} />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Public concerné</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="audience" value="INDIVIDUAL" defaultChecked={item?.audiences.includes('INDIVIDUAL')} className="size-4 accent-primary" /> Particuliers</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="audience" value="BUSINESS" defaultChecked={item?.audiences.includes('BUSINESS')} className="size-4 accent-primary" /> Professionnels</label>
        </fieldset>
        <Textarea label="Garanties potentielles" name="coverages" maxLength={10000} hint="Une par ligne, au format « titre | description ». Présentez uniquement des exemples indicatifs." defaultValue={item?.potentialCoverages.map(row => `${row.title} | ${row.description}`).join('\n')} />
        <Input label="Ordre d’affichage" type="number" name="displayOrder" required min={0} max={999} defaultValue={item?.displayOrder ?? 0} />
        <details className="rounded border border-line p-3">
          <summary className="font-semibold">Informations complémentaires</summary>
          <div className="mt-3 grid gap-3">
            <Textarea label="Informations sur le public" name="eligibility" maxLength={1000} defaultValue={item?.eligibilityText} />
            <Textarea label="Documents possibles" name="documents" maxLength={10000} hint="Une ligne par document." defaultValue={item?.documentHints.join('\n')} />
            <Textarea label="Questions fréquentes" name="faqs" maxLength={10000} hint="Une par ligne, au format « question | réponse »." defaultValue={item?.faqs.map(row => `${row.question} | ${row.answer}`).join('\n')} />
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-semibold">Assurances associées</legend>
              {catalog.filter(row => row.slug !== item?.slug && (row.isPublished || item?.relatedSlugs.includes(row.slug))).map(row =>
                <label key={row.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="related" value={row.slug} className="size-4 accent-primary" defaultChecked={item?.relatedSlugs.includes(row.slug)} />
                  {row.title}{row.isPublished ? '' : ' (indisponible)'}
                </label>)}
            </fieldset>
          </div>
        </details>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-primary" checked={active} onChange={event => {
            setActive(event.target.checked)
            if (!event.target.checked) setPublished(false)
          }} /> Produit actif
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-primary" checked={published} disabled={!active} onChange={event => setPublished(event.target.checked)} /> Publier dans le catalogue
        </label>
      </fieldset>
      {error && <ErrorState>{error}</ErrorState>}
      {canEdit && <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le produit'}</Button>}
    </form>
  )
}
