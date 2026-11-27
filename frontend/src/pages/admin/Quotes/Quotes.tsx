import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { IssuedQuoteList } from '../../../components/admin/IssuedQuoteList'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { productOptions } from '../../../data/insurance'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import { statusOptions } from '../../../utils/admin'

const statuses = statusOptions(['DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'])

export default function Quotes() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const invalidDates = Boolean(from && to && from > to)
  const query = new URLSearchParams({ limit: '10' })
  for (const name of ['status', 'productSlug', 'clientId', 'requestId', 'page', 'from', 'to']) {
    const value = params.get(name)
    if (value) query.set(name, value)
  }
  if (search.trim().length >= 2) query.set('q', search.trim())
  const filter = query.toString()
  const load = useCallback((signal: AbortSignal) => invalidDates ? Promise.resolve(undefined) : api.issuedQuotes(filter, signal), [filter, invalidDates])
  const { data, loading, error, reload } = useApiData(load)

  function change(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (name !== 'page') next.delete('page')
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: name !== 'page' })
  }

  return <>
    <AdminHeading title="Devis" action={<ActionLink to="/admin/devis/nouveau"><Plus size={16} aria-hidden /> Nouveau devis</ActionLink>} />
    <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      <Input label="Rechercher un devis" type="search" value={search} onChange={event => { setSearch(event.target.value); if (params.has('page')) change('page', '') }} maxLength={100} placeholder="Référence ou client" />
      <Select label="Statut" value={params.get('status') ?? ''} placeholder="Tous les statuts" options={statuses} onChange={event => change('status', event.target.value)} />
      <Select label="Catégorie" value={params.get('productSlug') ?? ''} placeholder="Toutes les assurances" options={productOptions} onChange={event => change('productSlug', event.target.value)} />
      <Input label="Créé du" type="date" value={from} onChange={event => change('from', event.target.value)} />
      <Input label="Créé au" type="date" value={to} onChange={event => change('to', event.target.value)} error={invalidDates ? 'Choisissez une date de fin après la date de début.' : undefined} />
    </div>
    {loading && !invalidDates && <LoadingState />}
    {error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
    {data && !invalidDates && <IssuedQuoteList rows={data.data} label="Liste des devis" pagination={{ ...data.meta, onPageChange: next => change('page', String(next)) }} />}
  </>
}
