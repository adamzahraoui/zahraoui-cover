import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseProduct, productOptions } from '../../data/insurance'
import type { DemoQuote, DemoRequest } from '../../data/demo'
import { demoId } from '../../utils/admin'
import { ActionLink, Button } from '../ui/Button'
import { Input, Select, Textarea } from '../ui/Fields'
import { DemoNote } from './AdminContent'
import { useDemoData } from './DemoData'

export function QuoteEditor({ record, request }: { record?: DemoQuote; request?: DemoRequest }) {
  const { data, setData } = useDemoData()
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const clients = data.clients.filter(row => !row.archived)
  const clientId = request?.clientId
  const linkedClient = clientId ? clients.find(row => row.id === clientId) : undefined

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const premium = String(values.get('premium') ?? '').trim().replace(',', '.')
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(premium) || Number(premium) <= 0) {
      setError('Saisissez un montant positif avec deux décimales au maximum.')
      event.currentTarget.querySelector<HTMLInputElement>('[name="premium"]')?.focus()
      return
    }
    const client = linkedClient?.id ?? String(values.get('client') ?? '')
    const product = request?.product ?? parseProduct(String(values.get('product') ?? ''))
    if (!product || !clients.some(row => row.id === client) || (request && !linkedClient)) return
    const quote: DemoQuote = {
      ...(record ?? demoId('DV')),
      clientId: client,
      product,
      partnerId: String(values.get('partner') ?? ''),
      premium: Number(premium).toFixed(2),
      conditions: String(values.get('conditions') ?? '').trim(),
      status: 'DRAFT',
      requestId: request?.id ?? record?.requestId,
    }
    setData(previous => ({
      ...previous,
      quotes: record ? previous.quotes.map(row => row.id === record.id ? quote : row) : [quote, ...previous.quotes],
    }))
    navigate(`/admin/devis/${quote.id}`)
  }

  if (request && !linkedClient) {
    return <DemoNote>Associez d’abord un client actif à la demande. <ActionLink to={`/admin/demandes/${request.id}`} variant="secondary">Ouvrir la demande</ActionLink></DemoNote>
  }

  return (
    <form className="panel grid gap-4 p-4 sm:p-6" onSubmit={save}>
      <DemoNote>Les montants saisis ici servent à tester l’interface. Une compagnie validée sera nécessaire pour traiter un devis réel.</DemoNote>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Client" name="client" disabled={Boolean(linkedClient)} required defaultValue={linkedClient?.id ?? record?.clientId ?? ''} placeholder="Choisir un client" options={clients.map(row => ({ value: row.id, label: row.displayName }))} />
        <Select label="Catégorie d’assurance" name="product" disabled={Boolean(request)} required defaultValue={request?.product ?? record?.product ?? ''} placeholder="Choisir une catégorie" options={productOptions} />
        <Select label="Compagnie partenaire (exemple)" name="partner" defaultValue={record?.partnerId ?? ''} placeholder="Aucune compagnie renseignée" options={data.partners.filter(row => row.active || row.id === record?.partnerId).map(row => ({ value: row.id, label: row.name }))} />
        <Input label="Prime annuelle estimée (MAD)" name="premium" inputMode="decimal" required maxLength={13} defaultValue={record?.premium} error={error} onChange={() => setError('')} placeholder="0,00" />
      </div>
      <Textarea label="Garanties et conditions (facultatif)" name="conditions" maxLength={2000} defaultValue={record?.conditions} />
      <div className="flex flex-wrap gap-2"><Button type="submit">Enregistrer le brouillon démo</Button><ActionLink to="/admin/devis" variant="secondary">Annuler</ActionLink></div>
    </form>
  )
}
