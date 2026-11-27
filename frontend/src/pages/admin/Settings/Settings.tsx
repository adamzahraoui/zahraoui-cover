import { useState } from 'react'
import type { FormEvent } from 'react'
import { AdminHeading, DemoNote, LocalFeedback } from '../../../components/admin/AdminContent'
import { useDemoData } from '../../../components/admin/DemoData'
import { Button } from '../../../components/ui/Button'
import { Input, Textarea } from '../../../components/ui/Fields'
import { company } from '../../../config/company'

export default function Settings() {
  const { data, setData } = useDemoData()
  const [saved, setSaved] = useState(false)

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const read = (name: string) => String(values.get(name) ?? '').trim()
    setData(previous => ({ ...previous, settings: { email: read('email'), address: read('address'), hours: read('hours') } }))
    setSaved(true)
  }

  return (
    <>
      <AdminHeading title="Paramètres de l’agence" />
      <form className="panel grid gap-5 p-4 sm:p-6" onSubmit={save} onChange={() => setSaved(false)}>
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">Coordonnées officielles</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom de l’agence" value={company.name} readOnly />
            <Input label="Téléphone principal" value={company.office.number} readOnly />
            <Input label="Téléphone assistance" value={company.assistance.number} readOnly />
          </div>
        </section>
        <section className="grid gap-4 border-t border-line pt-5">
          <h2 className="text-lg font-semibold">Coordonnées à confirmer</h2>
          <DemoNote>Ces champs sont vides au départ. Saisissez uniquement des données fictives pour tester le formulaire.</DemoNote>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Email officiel (aperçu)" name="email" type="email" maxLength={254} defaultValue={data.settings.email} />
            <Input label="Horaires d’ouverture (aperçu)" name="hours" maxLength={300} defaultValue={data.settings.hours} />
          </div>
          <Textarea label="Adresse officielle (aperçu)" name="address" maxLength={300} defaultValue={data.settings.address} />
        </section>
        <div><Button type="submit">Appliquer à la démonstration</Button></div>
        {saved && <LocalFeedback>Paramètres modifiés dans cette démonstration. Le site public n’a pas été modifié.</LocalFeedback>}
      </form>
    </>
  )
}
