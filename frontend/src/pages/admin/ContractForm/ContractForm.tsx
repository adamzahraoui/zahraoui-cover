import { useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { ActionLink, Button } from '../../../components/ui/Button'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import { ContractDetail } from './ContractDetail'
import { ContractEditor } from './ContractEditor'

function ContractCreate() {
  const [params] = useSearchParams()
  const quoteId = params.get('devis')
  const loadQuote = useCallback((signal: AbortSignal) => quoteId ? api.issuedQuote(quoteId, signal) : Promise.resolve(undefined), [quoteId])
  const loadPrior = useCallback((signal: AbortSignal) => quoteId
    ? api.contracts(new URLSearchParams({ quoteId, limit: '1' }).toString(), signal)
    : Promise.resolve(undefined), [quoteId])
  const quote = useApiData(loadQuote)
  const prior = useApiData(loadPrior)
  const contract = prior.data?.data[0]
  const ready = quote.data?.id === quoteId && quote.data.status === 'ACCEPTED'
  return <>
    <AdminHeading title={quoteId ? 'Nouveau contrat' : 'Enregistrer une police externe'} parent={{ label: 'Contrats', to: '/admin/contrats' }} />
    {quoteId && (quote.loading || prior.loading) && <LoadingState />}
    {quoteId && (quote.error || prior.error) && <ErrorState>{businessError(quote.error ?? prior.error)} <Button variant="secondary" onClick={() => { quote.reload(); prior.reload() }}>Réessayer</Button></ErrorState>}
    {contract ? <div className="panel grid justify-items-start gap-3 p-4"><p>Un contrat est déjà lié à ce devis.</p><ActionLink to={`/admin/contrats/${contract.id}`}>Ouvrir le contrat</ActionLink></div>
      : !quoteId || (ready && prior.data && !prior.loading) ? <ContractEditor key={quoteId ?? 'external'} quote={quote.data} />
        : quote.data && !ready && <ErrorState>Le devis doit avoir une acceptation vérifiée.</ErrorState>}
  </>
}

export default function ContractForm() {
  const { id } = useParams()
  return id ? <ContractDetail id={id} /> : <ContractCreate />
}
