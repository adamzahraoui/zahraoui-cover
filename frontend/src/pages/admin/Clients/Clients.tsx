import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { RecordList } from '../../../components/admin/RecordList'
import type { Column } from '../../../components/admin/RecordList'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { ClientOption } from '../../../types/api'
import { profiles } from '../../../utils/admin'

const columns: Column<ClientOption>[] = [
  { title: 'Client', render: row => <Link className="text-link" to={`/admin/clients/${row.id}`}>{row.displayName}</Link> },
  { title: 'Type', render: row => profiles.find(item => item.value === row.profile)?.label },
  { title: 'Téléphone', render: row => row.phone },
  { title: 'Ville', render: row => row.city || '—' },
  { title: 'État', render: row => <StatusBadge label={row.archivedAt ? 'Archivé' : row.intakeProvisional ? 'Provisoire' : 'Vérifié'} tone={row.archivedAt || row.intakeProvisional ? 'neutral' : 'success'} /> },
]

export default function Clients() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const profile = params.get('profile') ?? ''
  const provisional = params.get('provisional') ?? ''
  const archived = params.get('archived') === 'true'
  const page = params.get('page') ?? '1'
  const search = new URLSearchParams({ page, limit: '10' })
  if (query.trim().length >= 2) search.set('q', query.trim())
  if (profile) search.set('profile', profile)
  if (provisional) search.set('provisional', provisional)
  if (archived) search.set('archived', 'true')
  const filter = search.toString()
  const load = useCallback((signal: AbortSignal) => api.clientOptions(filter, signal), [filter])
  const { data, loading, error, reload } = useApiData(load)

  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (key !== 'page') next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key !== 'page' })
  }

  return (
    <>
      <AdminHeading title="Clients" action={<ActionLink to="/admin/clients/nouveau"><Plus size={16} aria-hidden /> Ajouter un client</ActionLink>} />
      <div className="panel grid items-end gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Input label="Rechercher un client" type="search" placeholder="Nom, email, téléphone ou référence" value={query} onChange={event => { setQuery(event.target.value); if (page !== '1') change('page', '') }} maxLength={100} />
        <Select label="Profil" value={profile} placeholder="Tous les profils" options={profiles} onChange={event => change('profile', event.target.value)} />
        <Select label="Vérification" value={provisional} placeholder="Tous les états" options={[{ value: 'true', label: 'Provisoires' }, { value: 'false', label: 'Vérifiés' }]} onChange={event => change('provisional', event.target.value)} />
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={archived} onChange={event => change('archived', event.target.checked ? 'true' : '')} className="size-4 accent-primary" /> Afficher les archives</label>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
      {data && <RecordList rows={data.data} columns={columns} label="Liste des clients" pagination={{ ...data.meta, onPageChange: next => change('page', String(next)) }} />}
    </>
  )
}
