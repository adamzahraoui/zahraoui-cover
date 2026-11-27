import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Input, Select, Textarea } from '../ui/Fields'
import { productOptions } from '../../data/insurance'
import { validPhone } from '../../utils/forms'
import { NoticeCheckbox } from './NoticeCheckbox'

export function IntakeForm({ mode }: { mode: 'contact' | 'assistance' }) {
  const assistance = mode === 'assistance'
  const [phoneError, setPhoneError] = useState('')
  const [checked, setChecked] = useState(false)
  const [textError, setTextError] = useState('')

  function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const phoneOk = validPhone(String(values.get('phone') ?? ''))
    const messageOk = String(values.get('message') ?? '').trim().length >= 10
    setPhoneError(phoneOk ? '' : 'Indiquez un numéro marocain ou international valide.')
    setTextError(messageOk ? '' : 'Saisissez au moins 10 caractères utiles.')
    setChecked(phoneOk && messageOk)
    if (!phoneOk) form.querySelector<HTMLInputElement>('[name="phone"]')?.focus()
    else if (!messageOk) form.querySelector<HTMLTextAreaElement>('[name="message"]')?.focus()
  }

  return (
    <form className="panel grid gap-4 p-4 sm:p-6" onSubmit={validate} onChange={() => setChecked(false)}>
      <h2 className="text-xl font-bold">{assistance ? 'Soumettre une demande d’assistance' : 'Envoyer un message'}</h2>
      <p className="rounded bg-primary-tint p-3 text-sm leading-6 text-primary">Formulaire de démonstration. N’utilisez pas de données personnelles réelles. Aucune information ne sera envoyée.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nom et prénom" name="fullName" autoComplete="off" required minLength={2} maxLength={120} pattern=".*\S.*" />
        <Input label="Téléphone" name="phone" type="tel" autoComplete="off" required maxLength={24} error={phoneError} onChange={() => setPhoneError('')} placeholder="+212 600 000 000" />
        {assistance ? (
          <>
            <Select label="Type d’assurance" name="productSlug" options={productOptions} placeholder="Choisir une assurance" required />
            <Input label="Référence du contrat (facultatif)" name="contractReference" maxLength={64} />
          </>
        ) : (
          <>
            <Input label="Email" type="email" name="email" autoComplete="off" required maxLength={254} />
            <Input label="Objet" name="subject" required minLength={3} maxLength={120} pattern=".*\S.*" />
          </>
        )}
      </div>
      <Textarea label={assistance ? 'Description de la situation' : 'Message'} name="message" required minLength={10} maxLength={1000} error={textError} onChange={() => setTextError('')} hint="N’indiquez aucun renseignement médical ou document d’identité." />
      <NoticeCheckbox />
      <div><Button type="submit">Vérifier le formulaire</Button></div>
      {checked && <p role="status" className="rounded border border-blue-200 bg-primary-tint p-3 text-sm text-primary">Formulaire vérifié localement. Aucune demande n’a été envoyée.</p>}
    </form>
  )
}
