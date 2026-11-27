import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { ContractList } from '../../../components/admin/ContractList'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { productOptions } from '../../../data/insurance'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import { statusOptions } from '../../../utils/admin'

export default function Contracts() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const partners = useApiData(api.quotePartners)
  const from = params.get('expiresFrom') ?? ''
  const to = params.get('expiresTo') ?? ''
  const invalid = Boolean(from && to && from > to)
  const query = new URLSearchParams({ limit: '10' })
  for (const field of ['status', 'partnerId', 'productSlug', 'expiresFrom', 'expiresTo', 'clientId', 'quoteId', 'renewals', 'page']) {
    const value = params.get(field)
    if (value) query.set(field, value)
  }
  if (search.trim().length >= 2) query.set('q', search.trim())
  const searchString = query.toString()
  const load = useCallback((signal: AbortSignal) => invalid ? Promise.resolve(undefined) : api.contracts(searchString, signal), [invalid, searchString])
  const { data, error, loading, reload } = useApiData(load)

  function change(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (name !== 'page') next.delete('page')
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: name !== 'page' })
  }

  return <>
    <AdminHeading title="Contrats" action={<ActionLink to="/admin/contrats/nouveau"><Plus size={16} aria-hidden /> Enregistrer une police externe</ActionLink>} />
    <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      <Input label="Rechercher un contrat" type="search" placeholder="Référence, police ou client" value={search} maxLength={100}
        onChange={event => { setSearch(event.target.value); if (params.has('page')) change('page', '') }} />
      <Select label="Statut" value={params.get('status') ?? ''} placeholder="Tous les statuts"
        options={statusOptions(['DRAFT', 'SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'UNVERIFIED'])} onChange={event => change('status', event.target.value)} />
      <Select label="Catégorie" value={params.get('productSlug') ?? ''} placeholder="Toutes les assurances" options={productOptions} onChange={event => change('productSlug', event.target.value)} />
      <Select label="Compagnie" value={params.get('partnerId') ?? ''} placeholder="Toutes les compagnies"
        options={(partners.data ?? []).map(partner => ({ value: partner.id, label: partner.name }))} onChange={event => change('partnerId', event.target.value)} />
      <Input label="Échéance à partir du" type="date" value={from} onChange={event => change('expiresFrom', event.target.value)} />
      <Input label="Échéance jusqu’au" type="date" value={to} onChange={event => change('expiresTo', event.target.value)}
        error={invalid ? 'Choisissez une période d’échéance valide.' : undefined} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={params.get('renewals') === 'true'}
        onChange={event => change('renewals', event.target.checked ? 'true' : '')} /> Renouvellements à suivre</label>
    </div>
    {partners.error && <ErrorState>Le filtre des compagnies est indisponible. <Button variant="secondary" onClick={partners.reload}>Réessayer</Button></ErrorState>}
    {loading && !invalid && <LoadingState />}
    {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
    {data && !invalid && <ContractList label="Liste des contrats" rows={data.data} pagination={{ ...data.meta, onPageChange: page => change('page', String(page)) }} />}
  </>
}
