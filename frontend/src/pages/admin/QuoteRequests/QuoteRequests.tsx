import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { RequestList } from '../../../components/admin/RequestList'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { productOptions } from '../../../data/insurance'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import { statusOptions } from '../../../utils/admin'

const statuses = statusOptions(['NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'CLOSED'])
const loadAdvisors = (signal: AbortSignal) => api.staffOptions('limit=100', signal)

export default function QuoteRequests() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const dateError = Boolean(from && to && from > to)
  const filters = new URLSearchParams({ limit: '10' })
  for (const key of ['status', 'productSlug', 'assignedTo', 'from', 'to', 'page']) {
    const value = params.get(key)
    if (value) filters.set(key, value)
  }
  if (query.trim().length >= 2) filters.set('q', query.trim())
  const search = filters.toString()
  const load = useCallback((signal: AbortSignal) => dateError ? Promise.resolve(undefined) : api.quoteRequests(search, signal), [search, dateError])
  const { data, error, loading, reload } = useApiData(load)
  const advisors = useApiData(loadAdvisors)

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (key !== 'page') next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key !== 'page' })
  }

  return (
    <>
      <AdminHeading title="Demandes de devis" />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Rechercher une demande" type="search" placeholder="Nom, référence ou téléphone" maxLength={100} value={query} onChange={event => setFilter('q', event.target.value)} />
        <Select label="Statut" placeholder="Tous les statuts" options={statuses} value={params.get('status') ?? ''} onChange={event => setFilter('status', event.target.value)} />
        <Select label="Assurance" placeholder="Toutes les assurances" options={productOptions} value={params.get('productSlug') ?? ''} onChange={event => setFilter('productSlug', event.target.value)} />
        <Select label="Conseiller" placeholder="Tous les conseillers" options={(advisors.data?.data ?? []).map(item => ({ value: item.id, label: item.displayName }))} value={params.get('assignedTo') ?? ''} onChange={event => setFilter('assignedTo', event.target.value)} />
        <Input label="Du" type="date" value={from} onChange={event => setFilter('from', event.target.value)} />
        <Input label="Au" type="date" value={to} onChange={event => setFilter('to', event.target.value)} />
      </div>
      {dateError ? <ErrorState>La date de fin doit être postérieure ou égale à la date de début.</ErrorState>
        : loading ? <LoadingState />
          : error ? <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>
            : data && <RequestList rows={data.data} label="Demandes de devis" pagination={{ ...data.meta, onPageChange: page => setFilter('page', String(page)) }} />}
    </>
  )
}
