import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ActivityList, activityDate } from '../../../components/admin/ActivityList'
import { Facts, RecordStatus } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Input, Textarea } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { parseProduct, productOptions } from '../../../data/insurance'
import { api, businessError } from '../../../services/api'
import type { PartnerDetail, PartnerInput } from '../../../types/api'

export function PartnerEditor({ record, onSaved, reload }: {
  record?: PartnerDetail; onSaved: (partner: PartnerDetail, message: string) => void; reload: () => void
}) {
  const { state } = useAdminSession()
  const editable = state.status === 'authenticated' && state.user.role === 'ADMIN'
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function persist(action: (csrf: string) => Promise<PartnerDetail>, message: string) {
    if (busy || !editable || state.status !== 'authenticated') return
    setError('')
    setBusy(true)
    try { onSaved(await action(state.user.csrfToken), message) }
    catch (failure) { setError(businessError(failure)) }
    finally { setBusy(false) }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const optional = (field: string) => String(data.get(field) ?? '').trim() || null
    const payload: PartnerInput = {
      name: String(data.get('name') ?? '').trim(), displayName: optional('displayName'), contactPerson: optional('contactPerson'),
      phone: optional('phone'), email: optional('email'), website: optional('website'), address: optional('address'),
      internalNotes: optional('internalNotes'), categories: data.getAll('categories').map(value => parseProduct(String(value))).filter(value => value !== ''),
    }
    void persist(csrf => record ? api.updatePartner(record.id, { ...payload, version: record.version }, csrf)
      : api.createPartner(payload, csrf), 'Fiche partenaire enregistrée.')
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!record) return
    const data = new FormData(event.currentTarget)
    const reference = String(data.get('verificationReference') ?? '').trim()
    void persist(csrf => api.verifyPartner(record.id, { reference, version: record.version }, csrf), 'Vérification enregistrée.')
  }

  function updateVisibility(changes: { isActive?: boolean; isPublished?: boolean }, message: string) {
    if (record) void persist(csrf => api.updatePartner(record.id, { ...changes, version: record.version }, csrf), message)
  }

  return <div className="grid gap-5">
    {record && <Facts items={[
      ['Vérification', record.verifiedAt ? activityDate(record.verifiedAt) : 'En attente'],
      ['Vérifiée par', record.verifier?.displayName],
      ['Référence de vérification', record.verificationReference],
      ['Visibilité', record.isPublished ? 'Publique' : 'Privée'],
      ['État', record.isActive ? 'Active' : 'Inactive'],
    ]} />}
    <form className="grid gap-4" onSubmit={save}>
      <fieldset disabled={!editable || busy} className="grid min-w-0 gap-4">
        <Input label="Raison sociale" name="name" required minLength={2} maxLength={120} defaultValue={record?.name ?? ''} />
        <Input label="Nom d’affichage" name="displayName" maxLength={120} defaultValue={record?.displayName ?? ''} />
        <Input label="Site web HTTPS" name="website" type="url" maxLength={300} defaultValue={record?.website ?? ''} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Contact interne" name="contactPerson" maxLength={120} defaultValue={record?.contactPerson ?? ''} />
          <Input label="Téléphone interne" name="phone" type="tel" maxLength={32} defaultValue={record?.phone ?? ''} />
          <Input label="Email interne" name="email" type="email" maxLength={254} defaultValue={record?.email ?? ''} />
          <Input label="Adresse interne" name="address" maxLength={300} defaultValue={record?.address ?? ''} />
        </div>
        <Textarea label="Notes internes" name="internalNotes" maxLength={2000} defaultValue={record?.internalNotes ?? ''} />
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="text-sm font-semibold">Catégories couvertes</legend>
          {productOptions.map(({ value, label }) => <label key={value} className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="categories" value={value} className="mt-1 accent-primary"
              defaultChecked={record?.categories.some(category => category === value)} /> {label}
          </label>)}
        </fieldset>
      </fieldset>
      {editable && <div><Button type="submit" disabled={busy}>Enregistrer la compagnie</Button></div>}
    </form>

    {record && editable && <section className="grid gap-3 border-t border-line pt-4">
      <h3 className="font-semibold">Vérification et visibilité</h3>
      {!record.verifiedAt && <form className="grid gap-3" onSubmit={verify}>
        <Input label="Référence de vérification" name="verificationReference" required minLength={3} maxLength={160}
          hint="Vérifiez l’identité, le site et les catégories avant de confirmer." />
        <div><Button type="submit" variant="secondary" disabled={busy || !record.categories.length}>Vérifier la compagnie</Button></div>
      </form>}
      {record.verifiedAt && <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => record.isActive
          ? updateVisibility({ isActive: false }, 'Compagnie désactivée.')
          : updateVisibility({ isActive: true }, 'Compagnie activée.')}>{record.isActive ? 'Désactiver la compagnie' : 'Activer la compagnie'}</Button>
        {record.isActive && <Button variant="secondary" disabled={busy} onClick={() => record.isPublished
          ? updateVisibility({ isPublished: false }, 'Compagnie retirée du site.')
          : updateVisibility({ isPublished: true }, 'Compagnie publiée.')}>{record.isPublished ? 'Retirer du site' : 'Publier sur le site'}</Button>}
      </div>}
    </section>}
    {error && <ErrorState>{error} {record && <Button variant="secondary" onClick={reload}>Recharger la fiche</Button>}</ErrorState>}
    {record && <section className="grid gap-3 border-t border-line pt-4">
      <h3 className="font-semibold">Historique des dossiers</h3>
      {record.recentQuotes.length || record.recentContracts.length ? <ul className="grid gap-2 text-sm">
        {record.recentQuotes.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2">
          <Link className="text-link" to={`/admin/devis/${row.id}`}>{row.reference}</Link><RecordStatus status={row.status} />
        </li>)}
        {record.recentContracts.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2">
          <Link className="text-link" to={`/admin/contrats/${row.id}`}>{row.reference}</Link><RecordStatus status={row.status} />
        </li>)}
      </ul> : <p className="text-sm text-muted">Aucun devis ou contrat associé.</p>}
      <h3 className="font-semibold">Activité</h3>
      <ActivityList activity={record.activity} />
    </section>}
  </div>
}
