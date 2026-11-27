import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminHeading, DemoNote, NoRecord } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { ActionLink, Button } from '../../../components/ui/Button'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import type { DemoClient } from '../../../data/demo'
import { profiles } from '../../../utils/admin'
import { validPhone } from '../../../utils/forms'

function Editor({ record }: { record?: DemoClient }) {
  const { data, setData } = useDemoData()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [phone, setPhone] = useState(record?.phone ?? '')
  const phoneKey = phone.replace(/[^\d]/g, '').slice(-9)
  const duplicate = phoneKey.length === 9 && data.clients.some(row => row.id !== record?.id && row.phone.replace(/[^\d]/g, '').slice(-9) === phoneKey)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const text = (name: string) => String(values.get(name) ?? '').trim()
    if (!validPhone(phone)) {
      setError('Indiquez un numéro marocain ou international valide.')
      event.currentTarget.querySelector<HTMLInputElement>('[name="phone"]')?.focus()
      return
    }
    const client: DemoClient = {
      id: record?.id ?? crypto.randomUUID(),
      profile: values.get('profile') === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL',
      displayName: text('displayName'),
      phone: phone.trim(),
      city: text('city') || undefined,
      email: text('email') || undefined,
      notes: text('notes') || undefined,
    }
    setData(previous => ({
      ...previous,
      clients: record ? previous.clients.map(row => row.id === record.id ? client : row) : [client, ...previous.clients],
    }))
    navigate(`/admin/clients/${client.id}`)
  }

  return (
    <form onSubmit={save} className="panel grid gap-4 p-4 sm:p-6">
      <DemoNote>Utilisez uniquement des exemples fictifs. La fiche est conservée en mémoire jusqu’à la sortie de l’espace de démonstration ou au rechargement.</DemoNote>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Type de client" name="profile" options={profiles} required defaultValue={record?.profile ?? 'INDIVIDUAL'} />
        <Input label="Nom complet ou raison sociale" name="displayName" required minLength={2} maxLength={120} pattern=".*\S.*" defaultValue={record?.displayName} />
        <Input label="Téléphone" name="phone" type="tel" required maxLength={24} value={phone} error={error} onChange={event => { setPhone(event.target.value); setError('') }} />
        <Input label="Email (facultatif)" name="email" type="email" maxLength={254} defaultValue={record?.email} />
        <Input label="Ville (facultatif)" name="city" maxLength={100} defaultValue={record?.city} />
      </div>
      {duplicate && <DemoNote>Une autre fiche utilise ce numéro. Vérifiez les doublons avant de continuer.</DemoNote>}
      <Textarea label="Notes complémentaires (facultatif)" name="notes" maxLength={1000} defaultValue={record?.notes} hint="Aucun document d’identité ni renseignement médical." />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Enregistrer dans la démo</Button>
        <ActionLink to={record ? `/admin/clients/${record.id}` : '/admin/clients'} variant="secondary">Annuler</ActionLink>
      </div>
    </form>
  )
}

export default function ClientForm() {
  const { id } = useParams()
  const { data } = useDemoData()
  const record = data.clients.find(row => row.id === id)
  if (id && (!record || record.archived)) return <NoRecord title="Fiche indisponible" back="/admin/clients" />
  return (
    <>
      <AdminHeading title={record ? 'Modifier un client' : 'Ajouter un client'} parent={{ label: 'Clients', to: '/admin/clients' }} />
      <Editor key={id ?? 'new'} record={record} />
    </>
  )
}
