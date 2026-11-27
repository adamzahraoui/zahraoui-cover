import { useState } from 'react'
import type { FormEvent } from 'react'
import { LocalFeedback } from '../../../components/admin/AdminContent'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { productOptions } from '../../../data/insurance'
import { api, businessError } from '../../../services/api'
import type { ExportKind } from '../../../types/api'
import { statusOptions } from '../../../utils/admin'
import { importKinds } from './ImportReport'

const datasets = [...importKinds, { value: 'QUOTE_REQUESTS', label: 'Demandes de devis' }, { value: 'ISSUED_QUOTES', label: 'Devis émis' }]
const states = {
  PARTNERS: ['UNVERIFIED', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'PUBLISHED'],
  CONTRACTS: ['DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'CANCELLED', 'UNVERIFIED'],
  QUOTE_REQUESTS: ['NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'CLOSED'],
  ISSUED_QUOTES: ['ISSUED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'],
} as const
const partnerLabels = ['À vérifier', 'Vérifiées', 'Actives', 'Inactives', 'Publiées']

export function ExportForm() {
  const [kind, setKind] = useState<ExportKind>('CLIENTS')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function exportRows(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const filters = new URLSearchParams()
    for (const [field, value] of new FormData(event.currentTarget)) {
      if (typeof value === 'string' && value.trim()) filters.set(field, value.trim())
    }
    if (filters.get('q')?.length === 1) {
      setError('La recherche doit comporter au moins deux caractères.')
      return
    }
    setBusy(true); setError(''); setSaved(false)
    try { await api.downloadExport(kind, filters); setSaved(true) }
    catch (failure) { setError(businessError(failure)) }
    finally { setBusy(false) }
  }

  const dateFilters = kind === 'CONTRACTS' || kind === 'QUOTE_REQUESTS' || kind === 'ISSUED_QUOTES'
  return <section className="panel grid gap-4 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Exporter des données</h2>
    <p className="text-sm text-muted">Choisissez un format et affinez les filtres. Un fichier contient jusqu’à 2 000 dossiers.</p>
    <form className="grid gap-4" onSubmit={exportRows}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Données à exporter" value={kind} options={datasets} disabled={busy} onChange={event => { setKind(event.target.value as ExportKind); setError(''); setSaved(false) }} />
        <Select label="Format du fichier" name="format" defaultValue="xlsx" options={[{ value: 'xlsx', label: 'Excel (XLSX)' }, { value: 'csv', label: 'CSV' }]} />
      </div>
      <div key={kind} className="grid gap-4 sm:grid-cols-2">
        <Input label="Recherche" name="q" type="search" maxLength={100} />
        {kind === 'CLIENTS' ? <>
          <Select label="Profil" name="profile" placeholder="Tous les profils" options={[{ value: 'INDIVIDUAL', label: 'Particuliers' }, { value: 'BUSINESS', label: 'Entreprises' }]} />
          <Select label="Vérification" name="provisional" placeholder="Tous les niveaux" options={[{ value: 'true', label: 'Provisoires' }, { value: 'false', label: 'Vérifiés' }]} />
          <Select label="Archivage" name="archived" defaultValue="false" options={[{ value: 'false', label: 'Clients actuels' }, { value: 'true', label: 'Clients archivés' }]} />
        </> : <>
          <Select label="Catégorie" name="productSlug" placeholder="Toutes les catégories" options={productOptions} />
          <Select label="Statut" name="status" placeholder="Tous les statuts"
            options={kind === 'PARTNERS' ? states.PARTNERS.map((value, index) => ({ value, label: partnerLabels[index] })) : statusOptions(states[kind])} />
        </>}
        {dateFilters && <>
          <Input label={kind === 'CONTRACTS' ? 'Échéance à partir du' : 'Date de début'} name={kind === 'CONTRACTS' ? 'expiresFrom' : 'from'} type="date" />
          <Input label={kind === 'CONTRACTS' ? 'Échéance jusqu’au' : 'Date de fin'} name={kind === 'CONTRACTS' ? 'expiresTo' : 'to'} type="date" />
        </>}
      </div>
      <div><Button type="submit" disabled={busy}>{busy ? 'Préparation…' : 'Télécharger l’export'}</Button></div>
    </form>
    {error && <ErrorState>{error}</ErrorState>}
    {saved && <LocalFeedback>Export téléchargé.</LocalFeedback>}
  </section>
}
