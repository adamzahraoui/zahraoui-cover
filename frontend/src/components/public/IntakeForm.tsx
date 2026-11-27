import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Input, Select, Textarea } from '../ui/Fields'
import { ErrorState, LoadingState } from '../ui/States'
import { parseProduct } from '../../data/insurance'
import { useApiData } from '../../hooks/useApiData'
import { ApiError, api, businessError } from '../../services/api'
import type { Receipt } from '../../types/api'
import { validPhone } from '../../utils/forms'
import { NoticeCheckbox } from './NoticeCheckbox'
import { usePublicCatalog } from './PublicCatalog'

export function IntakeForm({ mode }: { mode: 'contact' | 'assistance' }) {
  const assistance = mode === 'assistance'
  const loadNotice = useCallback((signal: AbortSignal) => api.supportNotice(mode, signal), [mode])
  const notice = useApiData(loadNotice)
  const catalog = usePublicCatalog()
  const [checked, setChecked] = useState(false)
  const [receipt, setReceipt] = useState<Receipt>()
  const [failure, setFailure] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const submission = useRef<(() => Promise<Receipt>) | null>(null)
  const inFlight = useRef(false)
  const confirmation = useRef<HTMLHeadingElement>(null)
  const products = catalog.data ?? []

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    if (!submission.current) {
      const version = notice.data?.noticeVersion
      if (!version || !checked) return
      const values = new FormData(event.currentTarget)
      const text = (name: string) => String(values.get(name) ?? '').trim()
      const common = { fullName: text('fullName'), phone: text('phone'), noticeVersion: version, acknowledged: true as const }
      const field = assistance ? 'description' : 'message'
      const localErrors: Record<string, string> = {}
      if (!validPhone(common.phone)) localErrors.phone = 'Indiquez un numéro marocain ou international valide.'
      if (text(field).length < 10) localErrors[field] = 'Saisissez au moins 10 caractères utiles.'
      setErrors(localErrors)
      if (Object.keys(localErrors).length) {
        event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(localErrors)[0]}"]`)?.focus()
        return
      }
      const key = crypto.randomUUID()
      if (assistance) {
        const productSlug = parseProduct(text('productSlug'))
        if (!productSlug) return
        const body = { ...common, productSlug, description: text(field), contractReference: text('contractReference') || undefined }
        submission.current = () => api.submitAssistance(body, key)
      } else {
        const body = { ...common, email: text('email'), subject: text('subject'), message: text(field) }
        submission.current = () => api.submitContact(body, key)
      }
    }
    inFlight.current = true
    setBusy(true)
    setFailure('')
    try {
      const result = await submission.current()
      if (!result?.reference) throw new Error('Référence manquante')
      setReceipt(result)
      submission.current = null
      setUncertain(false)
      requestAnimationFrame(() => confirmation.current?.focus())
    } catch (error) {
      const retry = !(error instanceof ApiError) || error.status >= 500 || error.status === 429
      setUncertain(retry)
      setFailure(retry ? 'La confirmation n’a pas pu être reçue. Réessayez le même envoi.' : businessError(error))
      if (!retry) submission.current = null
      if (error instanceof ApiError) {
        setErrors(error.fields ?? {})
        if (error.code === 'NOTICE_CHANGED') { setChecked(false); notice.reload() }
        if (error.code === 'PRODUCT_UNAVAILABLE') catalog.reload()
      }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  if (receipt) return (
    <section role="status" className="panel grid gap-4 p-4 sm:p-6">
      <h2 className="text-xl font-bold text-primary" ref={confirmation} tabIndex={-1}>{assistance ? 'Votre demande d’assistance a bien été reçue.' : 'Votre message a bien été reçu.'}</h2>
      <p>Conservez votre référence <strong className="wrap-anywhere">{receipt.reference}</strong>.</p>
      <div><Button variant="secondary" onClick={() => { setReceipt(undefined); setChecked(false); notice.reload() }}>Nouvel envoi</Button></div>
    </section>
  )

  return (
    <form className="panel grid gap-4 p-4 sm:p-6" onSubmit={send}>
      <h2 className="text-xl font-bold">{assistance ? 'Soumettre une demande d’assistance' : 'Envoyer un message'}</h2>
      {notice.loading && !notice.data && <LoadingState />}
      {notice.error && <ErrorState>La notice est indisponible. <Button variant="secondary" onClick={notice.reload}>Réessayer</Button></ErrorState>}
      {notice.data && !notice.data.noticeVersion && <ErrorState>Le formulaire en ligne est indisponible. Vous pouvez appeler le numéro affiché sur cette page.</ErrorState>}
      {assistance && catalog.error && <ErrorState>Le catalogue est indisponible. <Button variant="secondary" onClick={catalog.reload}>Recharger les assurances</Button></ErrorState>}
      {assistance && catalog.data && !products.length && <p className="text-sm text-muted">Aucune catégorie n’est disponible pour le moment.</p>}
      <fieldset className="grid gap-4" disabled={busy || uncertain} onChange={() => setErrors({})}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nom et prénom" name="fullName" autoComplete="name" required minLength={2} maxLength={120} error={errors.fullName} />
          <Input label="Téléphone" name="phone" type="tel" autoComplete="tel" required maxLength={32} error={errors.phone} placeholder="+212 600 000 000" />
          {assistance ? <>
            <Select label="Type d’assurance" name="productSlug" options={products.map(item => ({ label: item.title, value: item.slug }))} placeholder="Choisir une assurance" required error={errors.productSlug} />
            <Input label="Référence du contrat (facultatif)" name="contractReference" maxLength={64} error={errors.contractReference} />
          </> : <>
            <Input label="Email" type="email" name="email" autoComplete="email" required maxLength={254} error={errors.email} />
            <Input label="Objet" name="subject" required minLength={3} maxLength={120} error={errors.subject} />
          </>}
        </div>
        <Textarea label={assistance ? 'Description de la situation' : 'Message'} name={assistance ? 'description' : 'message'} required minLength={10} maxLength={1000} error={errors[assistance ? 'description' : 'message']} hint="N’indiquez aucun renseignement médical ou document d’identité." />
        {notice.data?.text && <p className="rounded border border-line bg-background p-3 text-sm leading-6 whitespace-pre-line">{notice.data.text}</p>}
        <NoticeCheckbox checked={checked} onChange={event => setChecked(event.target.checked)} />
      </fieldset>
      {failure && <ErrorState>{failure}</ErrorState>}
      <div><Button type="submit" disabled={busy || (!uncertain && (notice.loading || !notice.data?.noticeVersion || (assistance && !products.length)))}>
        {busy ? 'Envoi…' : uncertain ? 'Réessayer l’envoi' : assistance ? 'Envoyer la demande' : 'Envoyer le message'}
      </Button></div>
    </form>
  )
}
