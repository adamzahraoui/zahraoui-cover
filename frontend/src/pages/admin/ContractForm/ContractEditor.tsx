import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Facts } from '../../../components/admin/AdminContent'
import { useAdminSession } from '../../../components/admin/auth/AdminSession'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { parseProduct, productOptions } from '../../../data/insurance'
import { useApiData } from '../../../hooks/useApiData'
import { api, businessError } from '../../../services/api'
import type { ContractDetail, IssuedQuote, PolicyFields } from '../../../types/api'

export function ContractEditor({ record, quote, saved }: {
  record?: ContractDetail; quote?: IssuedQuote; saved?: (contract: ContractDetail) => void
}) {
  const { state } = useAdminSession()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [client, setClient] = useState<{ id: string; label: string }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const manual = !record && !quote
  const loadPartners = useCallback((signal: AbortSignal) => manual ? api.quotePartners(signal) : Promise.resolve(undefined), [manual])
  const loadClients = useCallback((signal: AbortSignal) => manual && search.trim().length >= 2
    ? api.clientOptions(new URLSearchParams({ q: search.trim() }).toString(), signal) : Promise.resolve(undefined), [manual, search])
  const partners = useApiData(loadPartners)
  const clients = useApiData(loadClients)
  const clientOptions = [
    ...(client ? [{ value: client.id, label: client.label }] : []),
    ...(clients.data?.data ?? []).filter(entry => entry.id !== client?.id).map(entry => ({ value: entry.id, label: entry.displayName })),
  ]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || state.status !== 'authenticated') return
    const values = new FormData(event.currentTarget)
    const text = (name: string) => String(values.get(name) ?? '').trim()
    const payload: PolicyFields = {
      policyNumber: text('policyNumber') || null, coverage: text('coverage') || null, premiumMad: text('premiumMad').replace(',', '.') || null,
      effectiveOn: text('effectiveOn'), expiresOn: text('expiresOn'), internalNotes: text('internalNotes') || null, renewalReminders: values.has('reminders'),
    }
    const productSlug = parseProduct(text('productSlug'))
    if (payload.expiresOn <= payload.effectiveOn) { setError('L’échéance doit être postérieure à la date d’effet.'); return }
    if (manual && (!client || !productSlug)) { setError('Sélectionnez un client et une catégorie.'); return }
    setBusy(true)
    setError('')
    const csrf = state.user.csrfToken
    try {
      const result = record ? await api.updateContract(record.id, { ...payload, version: record.version }, csrf)
        : quote ? await api.convertQuote({ ...payload, quoteId: quote.id, quoteVersion: quote.version }, csrf)
          : client && productSlug ? await api.registerPolicy({ ...payload, clientId: client.id, partnerId: text('partnerId'), productSlug }, csrf)
            : undefined
      if (!result) return
      if (saved) saved(result)
      else navigate(`/admin/contrats/${result.id}`, { state: { saved: true } })
    } catch (error) { setError(businessError(error)) }
    finally { setBusy(false) }
  }

  return <form className="panel grid min-w-0 gap-4 p-4 sm:p-6" onSubmit={submit}>
    <h2 className="text-lg font-semibold">Informations du contrat</h2>
    <p className="text-sm text-muted">Saisissez les informations communiquées par la compagnie. Une confirmation vérifiée est nécessaire pour activer la fiche.</p>
    {(record || quote) && <Facts items={[
      ['Client', record?.clientName ?? quote?.clientName], ['Catégorie', record?.productTitle ?? quote?.productTitle],
      ['Compagnie', record?.partnerName ?? quote?.partnerName], ['Devis source', record?.quoteReference ?? quote?.reference],
    ]} />}
    {manual && partners.loading && <LoadingState />}
    {(partners.error || clients.error) && <ErrorState>{businessError(partners.error ?? clients.error)}</ErrorState>}
    {manual && partners.data?.length === 0 && <ErrorState>Aucune compagnie approuvée n’est disponible.</ErrorState>}
    <fieldset disabled={busy} className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {manual && <>
          <Input label="Rechercher un client" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
          <Select label="Client" value={client?.id ?? ''} required placeholder="Choisir un client" options={clientOptions}
            onChange={event => {
              const chosen = clientOptions.find(entry => entry.value === event.target.value)
              setClient(chosen && { id: chosen.value, label: chosen.label })
            }} />
          <Select label="Catégorie" name="productSlug" required defaultValue="" placeholder="Choisir une catégorie" options={productOptions} />
          <Select label="Compagnie" name="partnerId" required defaultValue="" placeholder="Choisir une compagnie" options={(partners.data ?? []).map(entry => ({ value: entry.id, label: entry.name }))} />
        </>}
        <Input label="Numéro de police de l’assureur" name="policyNumber" minLength={2} maxLength={64} defaultValue={record?.policyNumber ?? ''} />
        <Input label="Prime (MAD)" name="premiumMad" inputMode="decimal" pattern="[0-9]{1,10}([.,][0-9]{1,2})?" maxLength={13}
          defaultValue={record?.premiumMad ?? quote?.totalMad ?? ''} />
        <Input label="Date d’effet" name="effectiveOn" type="date" min={record?.previous?.expiresOn} required defaultValue={record?.effectiveOn} />
        <Input label="Échéance (jour exclu)" name="expiresOn" type="date" required defaultValue={record?.expiresOn} />
      </div>
      <Textarea label="Garanties" name="coverage" maxLength={3000} defaultValue={record?.coverage ?? quote?.coverage ?? ''} />
      <Textarea label="Notes internes" name="internalNotes" maxLength={2000} defaultValue={record?.internalNotes ?? ''} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reminders" defaultChecked={record?.renewalReminders ?? true} className="accent-primary" /> Planifier les rappels internes d’échéance</label>
    </fieldset>
    {error && <ErrorState>{error}</ErrorState>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={busy || (manual && !partners.data?.length)}>{busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button>
      {!record && <ActionLink to="/admin/contrats" variant="secondary">Retour aux contrats</ActionLink>}
    </div>
  </form>
}
