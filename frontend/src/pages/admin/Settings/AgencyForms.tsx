import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { LocalFeedback } from '../../../components/admin/AdminContent'
import { Button } from '../../../components/ui/Button'
import { Input, Textarea } from '../../../components/ui/Fields'
import { ErrorState } from '../../../components/ui/States'
import { api, businessError } from '../../../services/api'
import type { AgencyNotifications, AgencySettings } from '../../../types/api'

type Props = { settings: AgencySettings; csrf: string; saved: (value: AgencySettings) => void }

function useEditing() {
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return { dirty, busy, error, message, changed: () => { setDirty(true); setMessage('') },
    async persist(action: () => Promise<AgencySettings>, saved: Props['saved'], success: string) {
      if (busy) return
      setError(''); setBusy(true)
      try {
        const data = await action()
        setDirty(false); setMessage(success); saved(data)
      } catch (error) { setError(businessError(error)) }
      finally { setBusy(false) }
    },
  }
}

export function CompanyForm({ settings, csrf, saved }: Props) {
  const edit = useEditing()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const read = (name: string) => String(form.get(name) ?? '').trim()
    const optional = (name: string) => read(name) || null
    if (!form.has('approved')) return
    void edit.persist(() => api.updateAgency({
      version: settings.version, approved: true, agencyName: read('agencyName'), officePhone: read('officePhone'),
      assistancePhone: read('assistancePhone'), legalName: optional('legalName'), email: optional('email'),
      city: optional('city'), address: optional('address'), hours: optional('hours'), whatsappPhone: optional('whatsappPhone'),
      website: optional('website'), registration: optional('registration'), authorization: optional('authorization'),
      socialLinks: { facebook: optional('facebook'), instagram: optional('instagram'), linkedin: optional('linkedin') },
    }, csrf), saved, 'Informations publiques enregistrées.')
  }
  return <form className="panel grid gap-5 p-4 sm:p-6" onChange={edit.changed} onSubmit={submit}>
    <section id="informations" className="grid gap-3">
      <h2 className="text-lg font-semibold">Informations générales</h2>
      {!settings.publicApprovedAt && <p className="text-sm text-muted">Les compléments restent privés jusqu’à votre confirmation de publication.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Nom de l’agence" name="agencyName" defaultValue={settings.agencyName} required minLength={2} maxLength={120} />
        <Input label="Raison sociale" name="legalName" maxLength={180} defaultValue={settings.legalName ?? ''} />
        <Input label="Références d’immatriculation" name="registration" maxLength={300} defaultValue={settings.registration ?? ''} />
        <Input label="Références d’autorisation" name="authorization" maxLength={300} defaultValue={settings.authorization ?? ''} />
      </div>
    </section>
    <section id="coordonnees" className="grid gap-3 border-t border-line pt-4">
      <h2 className="text-lg font-semibold">Coordonnées</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Téléphone principal" name="officePhone" type="tel" defaultValue={settings.officePhone} required maxLength={28} />
        <Input label="Téléphone assistance" name="assistancePhone" type="tel" defaultValue={settings.assistancePhone} required maxLength={28} />
        <Input label="Email officiel" name="email" type="email" maxLength={254} defaultValue={settings.email ?? ''} />
        <Input label="Ville" name="city" maxLength={100} defaultValue={settings.city ?? ''} />
        <Input label="Horaires d’ouverture" name="hours" maxLength={300} defaultValue={settings.hours ?? ''} />
        <Input label="Numéro WhatsApp" name="whatsappPhone" type="tel" maxLength={28} defaultValue={settings.whatsappPhone ?? ''} />
        <Input label="Site officiel HTTPS" name="website" type="url" maxLength={300} defaultValue={settings.website ?? ''} />
        <Textarea label="Adresse officielle" name="address" maxLength={300} defaultValue={settings.address ?? ''} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['facebook', 'instagram', 'linkedin'] as const).map(name =>
          <Input key={name} label={{ facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn' }[name]}
            name={name} type="url" maxLength={300} defaultValue={settings.socialLinks[name] ?? ''} />)}
      </div>
    </section>
    <section className="grid gap-2 border-t border-line pt-4">
      <h2 className="text-lg font-semibold">Identité visuelle</h2>
      <p className="text-sm text-muted">{settings.logoUrl ? 'Le logo approuvé est disponible.' : 'Le fichier du logo officiel reste à fournir. Le nom de l’agence reste affiché.'}</p>
    </section>
    <label className="flex items-start gap-2 text-sm"><input className="mt-1 accent-primary" type="checkbox" required name="approved" /> Je confirme la publication des informations approuvées ci-dessus.</label>
    {edit.dirty && <p className="text-sm text-muted">Des modifications restent à enregistrer.</p>}
    {edit.error && <ErrorState>{edit.error}</ErrorState>}
    {edit.message && <LocalFeedback>{edit.message}</LocalFeedback>}
    <div><Button type="submit" disabled={edit.busy}>Enregistrer les informations publiques</Button></div>
  </form>
}

const alerts = [
  { key: 'quote', label: 'Demandes de devis' }, { key: 'contact', label: 'Messages de contact' },
  { key: 'assistance', label: 'Demandes d’assistance' }, { key: 'renewal', label: 'Rappels de renouvellement' },
] as const

export function NotificationsForm({ settings, csrf, saved }: Props) {
  const edit = useEditing()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const read = (name: string) => String(form.get(name) ?? '').trim()
    const recipient = (key: string) => ({ enabled: form.has(key), recipient: read(key + 'Recipient') || null })
    const notifications: AgencyNotifications = {
      quote: recipient('quote'), contact: recipient('contact'), assistance: recipient('assistance'), renewal: recipient('renewal'),
      quoteAcknowledgement: form.has('quoteAcknowledgement'), contactAcknowledgement: form.has('contactAcknowledgement'),
    }
    const reminderDays = read('days').split(',').map(value => Number(value.trim()))
    void edit.persist(() => api.updateNotifications({ version: settings.version, notifications, reminderDays }, csrf), saved,
      'Préférences et délais enregistrés.')
  }
  return <form className="panel grid gap-5 p-4 sm:p-6" onChange={edit.changed} onSubmit={submit}>
    <section id="notifications" className="grid gap-3">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="text-sm text-muted">{settings.localMail ? 'Livraison des préférences configurées dans la messagerie de test locale.' : 'Les préférences peuvent être enregistrées. Leur livraison exige le SMTP de test local.'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {alerts.map(({ key, label }) => <fieldset key={key} className="grid min-w-0 gap-2">
          <legend className="font-medium">{label}</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={key} defaultChecked={settings.notifications[key].enabled} /> Activer l’alerte interne</label>
          <Input label={'Destinataire · ' + label} name={key + 'Recipient'} type="email" maxLength={254} defaultValue={settings.notifications[key].recipient ?? ''} />
        </fieldset>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="quoteAcknowledgement" defaultChecked={settings.notifications.quoteAcknowledgement} /> Accusés de réception des demandes de devis</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="contactAcknowledgement" defaultChecked={settings.notifications.contactAcknowledgement} /> Accusés de réception des messages</label>
    </section>
    <section id="renouvellements" className="grid gap-3 border-t border-line pt-4">
      <h2 className="text-lg font-semibold">Renouvellements</h2>
      <Input label="Jours avant l’échéance" name="days" required maxLength={70} defaultValue={settings.reminderDays.join(', ')}
        hint="1 à 12 valeurs distinctes de 1 à 365 jours, séparées par des virgules. Les rappels en attente sont recalculés." />
    </section>
    {edit.dirty && <p className="text-sm text-muted">Des modifications restent à enregistrer.</p>}
    {edit.error && <ErrorState>{edit.error}</ErrorState>}
    {edit.message && <LocalFeedback>{edit.message}</LocalFeedback>}
    <div><Button type="submit" disabled={edit.busy}>Enregistrer les préférences</Button></div>
  </form>
}
