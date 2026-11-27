import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseProduct, productOptions } from '../../data/insurance'
import { useApiData } from '../../hooks/useApiData'
import { api, businessError } from '../../services/api'
import type { IssuedQuote, IssuedQuoteInput, RequestDetail } from '../../types/api'
import { casablancaToday } from '../../utils/forms'
import { ActionLink, Button } from '../ui/Button'
import { Input, Select, Textarea } from '../ui/Fields'
import { ErrorState, LoadingState } from '../ui/States'
import { Facts } from './AdminContent'
import { useAdminSession } from './auth/AdminSession'
import { quoteAmount } from './IssuedQuoteList'

export function QuoteEditor({ record, request, onSaved }: {
  record?: IssuedQuote; request?: RequestDetail; onSaved?: (record: IssuedQuote) => void
}) {
  const { state } = useAdminSession()
  const [category, setCategory] = useState<ReturnType<typeof parseProduct>>(record?.productSlug ?? request?.productSlug ?? '')
  const loadPartners = useCallback((signal: AbortSignal) => category ? api.quotePartners(category, signal) : Promise.resolve(undefined), [category])
  const partners = useApiData(loadPartners)
  const options = partners.loading ? [] : partners.data ?? []
  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const loadClients = useCallback((signal: AbortSignal) =>
    search.trim().length >= 2 && !record && !request
      ? api.clientOptions(new URLSearchParams({ q: search.trim() }).toString(), signal)
      : Promise.resolve(undefined), [search, record, request])
  const clients = useApiData(loadClients)
  const knownClient = record?.clientId ?? request?.clientId
  const customerOptions = [
    ...(clientId ? [{ value: clientId, label: clientName }] : []),
    ...(clients.data?.data ?? []).filter(row => row.id !== clientId).map(row => ({ value: row.id, label: row.displayName })),
  ]

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || state.status !== 'authenticated') return
    const values = new FormData(event.currentTarget)
    const text = (name: string) => String(values.get(name) ?? '').trim()
    const money = (name: string) => (text(name) || '0').replace(',', '.')
    const client = knownClient ?? clientId
    const product = record?.productSlug ?? request?.productSlug ?? parseProduct(text('product'))
    if (!client || !product) { setError('Sélectionnez un client et une catégorie.'); return }
    if (!options.some(option => option.id === text('partner'))) { setError('Sélectionnez une compagnie admissible pour cette catégorie.'); return }
    const body: IssuedQuoteInput = {
      clientId: client, requestId: record?.requestId ?? request?.id, productSlug: product, partnerId: text('partner'),
      annualPremiumMad: money('premium'), feesMad: money('fees'), taxesMad: money('taxes'), validUntil: text('validUntil') || null,
      coverage: text('coverage') || null, coverageLimits: text('limits') || null, deductibles: text('deductibles') || null,
      conditions: text('conditions') || null, customerNotes: text('customerNotes') || null, internalNotes: text('internalNotes') || null,
    }
    const csrf = state.user.csrfToken
    setBusy(true)
    setError('')
    try {
      const saved = record ? await api.updateIssuedQuote(record.id, { ...body, version: record.version }, csrf) : await api.createIssuedQuote(body, csrf)
      if (onSaved) onSaved(saved)
      else navigate(`/admin/devis/${saved.id}`, { state: { saved: true } })
    } catch (error) {
      setError(businessError(error))
    } finally { setBusy(false) }
  }

  if (request && (!request.client || request.client.archivedAt || ['ACCEPTED', 'CLOSED'].includes(request.status))) {
    return <ErrorState>Ouvrez une demande en cours avec un client actif. <ActionLink to={`/admin/demandes/${request.id}`}>Revoir la demande</ActionLink></ErrorState>
  }
  return (
    <form className="panel grid min-w-0 gap-4 p-4 sm:p-6" onSubmit={save}>
      <p className="text-sm text-muted">Saisissez les conditions et les prix vérifiés auprès de la compagnie. Le serveur calcule le total à l’enregistrement.</p>
      {partners.loading && <LoadingState />}
      {partners.error && <ErrorState>{businessError(partners.error)} <Button variant="secondary" onClick={partners.reload}>Réessayer</Button></ErrorState>}
      {category && !partners.loading && partners.data?.length === 0 && <ErrorState>Aucune compagnie vérifiée et active pour cette catégorie.</ErrorState>}
      {(record || request) && <Facts items={[
        ['Client', record?.clientName ?? request?.client?.displayName],
        ['Catégorie', record?.productTitle ?? request?.productTitle],
        ['Demande de devis', record?.requestReference ?? request?.reference],
      ]} />}
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {!record && !request && <>
            <Input label="Rechercher un client" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
            <Select label="Client" name="client" value={clientId} required placeholder="Choisir un client" options={customerOptions}
              onChange={event => { setClientId(event.target.value); setClientName(customerOptions.find(item => item.value === event.target.value)?.label ?? '') }} />
            {clients.error && <ErrorState>{businessError(clients.error)}</ErrorState>}
            <Select label="Catégorie d’assurance" name="product" required value={category} placeholder="Choisir une catégorie" options={productOptions} onChange={event => setCategory(parseProduct(event.target.value))} />
          </>}
          <Select key={category + ':' + String(partners.loading)} label="Compagnie approuvée" name="partner" required defaultValue={record?.partnerId ?? ''}
            placeholder={category ? 'Choisir une compagnie' : 'Sélectionner d’abord une catégorie'} disabled={!category || partners.loading}
            options={options.map(partner => ({ value: partner.id, label: partner.name }))} />
          <Input label="Validité jusqu’au" name="validUntil" type="date" min={casablancaToday()} defaultValue={record?.validUntil ?? ''} />
          <Input label="Prime annuelle (MAD)" name="premium" inputMode="decimal" required maxLength={13} pattern="[0-9]{1,10}([.,][0-9]{1,2})?" defaultValue={record?.annualPremiumMad} />
          <Input label="Frais (MAD)" name="fees" inputMode="decimal" maxLength={13} pattern="[0-9]{1,10}([.,][0-9]{1,2})?" defaultValue={record?.feesMad ?? '0.00'} />
          <Input label="Taxes (MAD)" name="taxes" inputMode="decimal" maxLength={13} pattern="[0-9]{1,10}([.,][0-9]{1,2})?" defaultValue={record?.taxesMad ?? '0.00'} />
          {record && <p className="self-end font-semibold">Total enregistré {quoteAmount(record.totalMad)}</p>}
        </div>
        <Textarea label="Garanties proposées" name="coverage" maxLength={3000} defaultValue={record?.coverage ?? ''} />
        <Textarea label="Plafonds et limites" name="limits" maxLength={2000} defaultValue={record?.coverageLimits ?? ''} />
        <Textarea label="Franchises" name="deductibles" maxLength={2000} defaultValue={record?.deductibles ?? ''} />
        <Textarea label="Conditions et exclusions" name="conditions" maxLength={2000} defaultValue={record?.conditions ?? ''} />
        <Textarea label="Notes destinées au client" name="customerNotes" maxLength={2000} defaultValue={record?.customerNotes ?? ''} />
        <Textarea label="Notes internes" name="internalNotes" maxLength={2000} defaultValue={record?.internalNotes ?? ''} />
      </fieldset>
      {error && <ErrorState>{error}</ErrorState>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !options.length}>{busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button>
        {!record && <ActionLink to={request ? `/admin/demandes/${request.id}` : '/admin/devis'} variant="secondary">Annuler</ActionLink>}
      </div>
    </form>
  )
}
