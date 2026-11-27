import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdminHeading } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { RequestList } from '../../../components/admin/RequestList'
import { Input, Select } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { demoAdvisors } from '../../../data/demo'
import { productOptions } from '../../../data/insurance'
import { statusOptions } from '../../../utils/admin'
import { searchable } from '../../../utils/forms'

const statuses = statusOptions(['NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'CLOSED'])

export default function QuoteRequests() {
  const { data } = useDemoData()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [product, setProduct] = useState('')
  const [advisor, setAdvisor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const dateError = Boolean(from && to && from > to)
  const rows = data.requests.filter(row => (
    (!status || row.status === status)
    && (!product || row.product === product)
    && (!advisor || row.assignee === advisor)
    && (!from || row.date >= from)
    && (!to || row.date <= to)
    && searchable(`${row.name} ${row.reference} ${row.phone}`).includes(searchable(query))
  ))

  return (
    <>
      <AdminHeading title="Demandes de devis" />
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Rechercher une demande" type="search" placeholder="Nom, référence ou téléphone" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} />
        <Select label="Statut" placeholder="Tous les statuts" options={statuses} value={status} onChange={event => {
          const next = new URLSearchParams(params)
          if (event.target.value) next.set('status', event.target.value)
          else next.delete('status')
          setParams(next, { replace: true })
        }} />
        <Select label="Assurance" placeholder="Toutes les assurances" options={productOptions} value={product} onChange={event => setProduct(event.target.value)} />
        <Select label="Conseiller" placeholder="Tous les conseillers" options={demoAdvisors} value={advisor} onChange={event => setAdvisor(event.target.value)} />
        <Input label="Du" type="date" value={from} onChange={event => setFrom(event.target.value)} />
        <Input label="Au" type="date" value={to} onChange={event => setTo(event.target.value)} />
      </div>
      {dateError ? <ErrorState>La date de fin doit être postérieure ou égale à la date de début.</ErrorState> : (
        <RequestList key={JSON.stringify([query, status, product, advisor, from, to])} rows={rows} label="Demandes de devis" />
      )}
    </>
  )
}
