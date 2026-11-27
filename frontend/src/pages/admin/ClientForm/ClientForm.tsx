import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminHeading, NoRecord } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, api, businessError } from '../../../services/api'
import type { Client, ClientIn, DuplicateClient } from '../../../types/api'
import { profiles } from '../../../utils/admin'
import { validPhone } from '../../../utils/forms'

function Editor({ record, reload }: { record?: Client; reload: () => void }) {
  const { state } = useAdminSession()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [candidates, setCandidates] = useState<DuplicateClient[]>([])
  const [confirmed, setConfirmed] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || state.status !== 'authenticated') return
    const values = new FormData(event.currentTarget)
    const text = (name: string) => String(values.get(name) ?? '').trim()
    const client: ClientIn = {
      profile: text('profile') === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL',
      displayName: text('displayName'), phone: text('phone'), city: text('city') || null, email: text('email') || null, notes: text('notes') || null,
    }
    if (!validPhone(client.phone)) {
      setFields({ phone: 'Indiquez un numéro marocain ou international valide.' })
      event.currentTarget.querySelector<HTMLInputElement>('[name="phone"]')?.focus()
      return
    }
    if (candidates.length && !confirmed) {
      setError('Vérifiez les correspondances et confirmez que cette fiche doit rester distincte.')
      return
    }
    setError('')
    setFields({})
    setBusy(true)
    const token = state.user.csrfToken
    const input = { ...client, confirmDuplicate: confirmed ? true as const : undefined }
    try {
      const saved = record
        ? await api.updateClient(record.id, { ...input, version: record.version, verify: values.has('verify') ? true : undefined }, token)
        : await api.createClient(input, token)
      navigate(`/admin/clients/${saved.id}`, { state: { savedClient: true } })
    } catch (failure) {
      setError(businessError(failure))
      if (failure instanceof ApiError) {
        setFields(failure.fields ?? {})
        if (failure.code === 'CLIENT_DUPLICATES') {
          try {
            const matches = await api.findDuplicates({ phone: client.phone, email: client.email, excludeId: record?.id }, token)
            setCandidates(matches)
            setConfirmed(false)
          } catch (lookupFailure) { setError(businessError(lookupFailure)) }
        }
      }
    } finally { setBusy(false) }
  }

  function changed(name: string) {
    setFields(previous => ({ ...previous, [name]: '' }))
    if (name === 'email' || name === 'phone') {
      setCandidates([])
      setConfirmed(false)
    }
  }

  return (
    <form onSubmit={save} className="panel grid gap-4 p-4 sm:p-6">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <Select label="Type de client" name="profile" options={profiles} required defaultValue={record?.profile ?? 'INDIVIDUAL'} error={fields.profile} />
        <Input label="Nom complet ou raison sociale" name="displayName" required minLength={2} maxLength={120} defaultValue={record?.displayName} error={fields.displayName} onChange={() => changed('displayName')} />
        <Input label="Téléphone" name="phone" type="tel" required maxLength={32} defaultValue={record?.phone} error={fields.phone} onChange={() => changed('phone')} />
        <Input label="Email (facultatif)" name="email" type="email" maxLength={254} defaultValue={record?.email ?? ''} error={fields.email} onChange={() => changed('email')} />
        <Input label="Ville (facultatif)" name="city" minLength={2} maxLength={100} defaultValue={record?.city ?? ''} error={fields.city} onChange={() => changed('city')} />
        {record?.intakeProvisional && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="verify" className="size-4 accent-primary" /> J’ai vérifié l’identité et les coordonnées de ce client.</label>}
      </fieldset>
      {candidates.length > 0 && <section className="grid gap-2 rounded border border-line bg-background p-4 text-sm">
        <h2 className="font-semibold">Correspondances à vérifier</h2>
        <ul className="grid gap-1">{candidates.map(candidate => <li key={candidate.id}><Link target="_blank" rel="noopener" className="text-link" to={`/admin/clients/${candidate.id}`}>{candidate.displayName} (nouvel onglet)</Link> · {candidate.archivedAt ? 'Archivé' : candidate.intakeProvisional ? 'Provisoire' : 'Vérifié'}</li>)}</ul>
        <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="size-4 accent-primary" /> J’ai vérifié les correspondances et je conserve une fiche distincte.</label>
      </section>}
      <Textarea label="Notes complémentaires (facultatif)" name="notes" maxLength={1000} defaultValue={record?.notes ?? ''} error={fields.notes} hint="Aucun document d’identité ni renseignement médical." />
      {error && <ErrorState>{error} {record && <Button variant="secondary" onClick={reload}>Recharger la fiche</Button>}</ErrorState>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le client'}</Button>
        <ActionLink to={record ? `/admin/clients/${record.id}` : '/admin/clients'} variant="secondary">Annuler</ActionLink>
      </div>
    </form>
  )
}

export default function ClientForm() {
  const { id } = useParams()
  const load = useCallback((signal: AbortSignal) => id ? api.client(id, signal) : Promise.resolve(undefined), [id])
  const { data, loading, error, reload } = useApiData(load)
  if (id && (data?.archivedAt || (error instanceof ApiError && [400, 404].includes(error.status)))) return <NoRecord title="Fiche indisponible" back="/admin/clients" />
  return (
    <>
      <AdminHeading title={id ? 'Modifier un client' : 'Ajouter un client'} parent={{ label: 'Clients', to: '/admin/clients' }} />
      {id && loading && <LoadingState />}
      {id && error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
      {(!id || data?.id === id) && <Editor key={data?.version ?? 'new'} record={data} reload={reload} />}
    </>
  )
}
