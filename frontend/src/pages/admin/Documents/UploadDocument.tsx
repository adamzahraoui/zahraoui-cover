import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { DocumentDetail } from '../../../types/api'

export const categories = [
  { value: 'QUOTE_PDF', label: 'Proposition de courtage' },
  { value: 'CONTRACT_PDF', label: 'Police de l’assureur' },
  { value: 'CONTRACT_SUPPORT', label: 'Pièce complémentaire' },
  { value: 'BUSINESS_PDF', label: 'Autre document approuvé' },
] as const
const uploadCategories = categories.slice(1)
const allowed = ['DRAFT', 'ACTIVE', 'SCHEDULED']

export function UploadDocument({ contractId, clientId, onSaved }: {
  contractId?: string; clientId?: string; onSaved: (data: DocumentDetail) => void
}) {
  const { state } = useAdminSession()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = contractId ?? chosen
  const loadOptions = useCallback((signal: AbortSignal) => {
    if (contractId || query.trim().length < 2) return Promise.resolve(undefined)
    const params = new URLSearchParams({ q: query.trim(), limit: '20' })
    if (clientId) params.set('clientId', clientId)
    return api.contracts(params.toString(), signal)
  }, [clientId, contractId, query])
  const loadContract = useCallback((signal: AbortSignal) => selected ? api.contract(selected, signal) : Promise.resolve(undefined), [selected])
  const options = useApiData(loadOptions)
  const details = useApiData(loadContract)
  const contract = details.data?.id === selected ? details.data : undefined
  const eligible = contract && allowed.includes(contract.status) && (!clientId || clientId === contract.clientId)

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contract || !eligible || busy || state.status !== 'authenticated') return
    const form = new FormData(event.currentTarget)
    const file = form.get('pdf')
    const kind = uploadCategories.find(option => option.value === form.get('kind'))?.value
    if (!kind || kind === 'QUOTE_PDF' || !(file instanceof File) || !/\.pdf$/i.test(file.name) ||
      file.type !== 'application/pdf' || file.size === 0 || file.size > 4 * 1024 * 1024) {
      setError('Choisissez un fichier PDF de 4 Mio maximum.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onSaved(await api.uploadDocument({
        contractId: contract.id, clientId: contract.clientId, version: contract.version, kind,
      }, file, state.user.csrfToken))
    } catch (error) {
      setError(businessError(error))
      details.reload()
    } finally { setBusy(false) }
  }

  return <form className="grid gap-4" onSubmit={upload}>
    <p className="text-sm text-muted">Dépôt local réservé aux PDF approuvés. N’ajoutez ni pièce d’identité ni dossier médical.</p>
    {!contractId && <>
      <Input label="Rechercher un contrat" type="search" value={query} maxLength={100} onChange={event => { setQuery(event.target.value); setChosen('') }} />
      <Select label="Contrat à associer" value={chosen} required disabled={options.loading || busy} placeholder="Choisir le contrat"
        options={(options.data?.data ?? []).filter(row => allowed.includes(row.status)).map(row => ({ value: row.id, label: row.reference + ' · ' + row.clientName }))}
        onChange={event => setChosen(event.target.value)} />
      {options.error && <ErrorState>{businessError(options.error)} <Button variant="secondary" onClick={options.reload}>Réessayer</Button></ErrorState>}
      {query.trim().length >= 2 && !options.loading && options.data && !options.data.data.some(row => allowed.includes(row.status)) &&
        <p className="text-sm text-muted">Aucun contrat admissible pour cette recherche.</p>}
    </>}
    {selected && details.loading && <LoadingState />}
    {details.error && <ErrorState>{businessError(details.error)} <Button variant="secondary" onClick={details.reload}>Réessayer</Button></ErrorState>}
    {contract && <p className="break-words text-sm">{contract.reference} · {contract.clientName}</p>}
    {contract && !eligible && <ErrorState>Ce contrat n’accepte pas ce dépôt.</ErrorState>}
    <Select label="Catégorie du document" name="kind" required defaultValue="CONTRACT_PDF" options={[...uploadCategories]} />
    <Input label="Fichier PDF" name="pdf" type="file" required accept=".pdf,application/pdf" hint="4 Mio maximum." />
    {error && <ErrorState>{error}</ErrorState>}
    <div><Button type="submit" disabled={!eligible || busy || details.loading}>{busy ? 'Dépôt en cours…' : 'Déposer le PDF'}</Button></div>
  </form>
}
