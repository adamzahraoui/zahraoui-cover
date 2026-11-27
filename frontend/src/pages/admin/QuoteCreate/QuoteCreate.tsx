import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { QuoteEditor } from '../../../components/admin/QuoteEditor'
import { Button } from '../../../components/ui/Button'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'

export default function QuoteCreate() {
  const [params] = useSearchParams()
  const id = params.get('demande')
  const load = useCallback((signal: AbortSignal) => id ? api.quoteRequest(id, signal) : Promise.resolve(undefined), [id])
  const { data, loading, error, reload } = useApiData(load)
  return <>
    <AdminHeading title="Nouveau devis" parent={{ label: 'Devis', to: '/admin/devis' }} />
    {id && loading && <LoadingState />}
    {id && error && <ErrorState>{businessError(error)} <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
    {(!id || data?.id === id) && <QuoteEditor key={id ?? 'new'} request={data} />}
  </>
}
