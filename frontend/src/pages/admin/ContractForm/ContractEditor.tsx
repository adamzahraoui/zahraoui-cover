import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoNote, LocalFeedback } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/Fields'
import type { DemoContract, DemoQuote } from '../../../data/demo'
import { parseProduct, productOptions } from '../../../data/insurance'
import { demoId } from '../../../utils/admin'
import { searchable } from '../../../utils/forms'

type FormErrors = { policy?: string; endOn?: string }

export function ContractEditor({ record, quote }: { record?: DemoContract; quote?: DemoQuote }) {
  const { data, setData } = useDemoData()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<FormErrors>({})
  const [saved, setSaved] = useState(false)
  const activeClients = data.clients.filter(row => !row.archived)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const text = (name: string) => String(values.get(name) ?? '').trim()
    const clientId = quote?.clientId ?? text('client')
    const partnerId = quote?.partnerId ?? text('partner')
    const product = quote?.product ?? parseProduct(text('product'))
    const policy = text('policy')
    const startOn = text('startOn')
    const endOn = text('endOn')

    const duplicate = data.contracts.some(row => row.id !== record?.id && row.partnerId === partnerId && searchable(row.policy) === searchable(policy))
    const errors: FormErrors = {
      policy: policy.length < 2 ? 'Indiquez un numéro de police utile.' : duplicate ? 'Ce numéro existe déjà pour cette compagnie.' : undefined,
      endOn: endOn <= startOn ? 'L’échéance doit être postérieure à la date d’effet.' : undefined,
    }
    setErrors(errors)
    if (errors.policy || errors.endOn) {
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${errors.policy ? 'policy' : 'endOn'}"]`)?.focus()
      return
    }
    if (!product || !activeClients.some(row => row.id === clientId)) return

    const contract: DemoContract = {
      ...(record ?? demoId('CTR')),
      clientId, partnerId, product, policy, startOn, endOn, status: 'DRAFT',
      quoteId: quote?.id ?? record?.quoteId,
    }
    setData(previous => ({
      ...previous,
      contracts: record ? previous.contracts.map(row => row.id === record.id ? contract : row) : [contract, ...previous.contracts],
    }))
    if (record) setSaved(true)
    else navigate(`/admin/contrats/${contract.id}`)
  }

  if (quote && !activeClients.some(row => row.id === quote.clientId)) return <DemoNote>Le client du devis n’est plus disponible pour créer ce contrat.</DemoNote>

  return (
    <form className="panel grid gap-4 p-4 sm:p-6" onSubmit={save} onChange={() => { setErrors({}); setSaved(false) }}>
      <h2 className="text-lg font-semibold">Informations du contrat</h2>
      <DemoNote>Exemples fictifs uniquement. Aucune police n’est souscrite à partir de cet écran.</DemoNote>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Numéro de police" name="policy" required minLength={2} maxLength={64} error={errors.policy} defaultValue={record?.policy} />
        <Select label="Client" name="client" required disabled={Boolean(quote)} defaultValue={quote?.clientId ?? record?.clientId ?? ''} options={activeClients.map(row => ({ value: row.id, label: row.displayName }))} placeholder="Choisir un client" />
        <Select label="Catégorie" name="product" required disabled={Boolean(quote)} defaultValue={quote?.product ?? record?.product ?? ''} options={productOptions} placeholder="Choisir un produit" />
        <Select label="Compagnie (exemple)" name="partner" disabled={Boolean(quote)} defaultValue={quote?.partnerId ?? record?.partnerId ?? ''} options={data.partners.filter(row => row.active || row.id === record?.partnerId || row.id === quote?.partnerId).map(row => ({ value: row.id, label: row.name }))} placeholder="Aucune compagnie renseignée" />
        <Input label="Date d’effet" name="startOn" type="date" required defaultValue={record?.startOn} />
        <Input label="Date d’échéance" name="endOn" type="date" required defaultValue={record?.endOn} error={errors.endOn} />
      </div>
      <div className="flex flex-wrap gap-2"><Button type="submit">Enregistrer le brouillon démo</Button><ActionLink to="/admin/contrats" variant="secondary">Retour aux contrats</ActionLink></div>
      {saved && <LocalFeedback>Brouillon actualisé dans cette démonstration.</LocalFeedback>}
    </form>
  )
}
