import { ClipboardCheck, Headset, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePublicCatalog } from '../../../components/public/PublicCatalog'
import { ErrorState, LoadingState } from '../../../components/ui/States'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, api, businessError } from '../../../services/api'
import type { QuoteRequestIn, Receipt } from '../../../types/api'
import { ContentCard } from '../../../components/public/PublicSections'
import { ActionLink, Button } from '../../../components/ui/Button'
import { useCompany } from '../../../config/CompanyProvider'
import { QuoteFields } from './QuoteFields'
import { initialDraft, steps, validateStep } from './quoteForm'
import type { QuoteDraft, QuoteErrors } from './quoteForm'

function QuoteWizard({ query }: { query: URLSearchParams }) {
  const company = useCompany()
  const [draft, setDraft] = useState(() => initialDraft(query))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<QuoteErrors>({})
  const [receipt, setReceipt] = useState<(Receipt & { title: string })>()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const { data: products = [], loading, error, reload } = usePublicCatalog()
  const notice = useApiData(api.quoteNotice)
  const submission = useRef<{ body: QuoteRequestIn; key: string } | null>(null)
  const inFlight = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)

  function focusHeading() {
    requestAnimationFrame(() => heading.current?.focus())
  }

  function update(changes: Partial<QuoteDraft>) {
    setFailure('')
    setDraft(previous => ({ ...previous, ...changes }))
    setErrors(previous => {
      const next = { ...previous }
      for (const key of Object.keys(changes) as (keyof QuoteDraft)[]) delete next[key]
      return next
    })
  }

  function changeStep(next: number) {
    setErrors({})
    setStep(next)
    focusHeading()
  }

  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const selected = products.find(item => item.slug === draft.product)
    const validation = validateStep(step, draft)
    if (step === 0 && draft.product && (!selected || (draft.profile && !selected.audiences.includes(draft.profile)))) {
      validation.product = 'Sélectionnez une assurance disponible pour votre profil.'
    }
    setErrors(validation)
    const field = Object.keys(validation)[0]
    if (field && !uncertain) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
      return
    }
    if (step < steps.length - 1) {
      changeStep(step + 1)
      return
    }
    if (!submission.current) {
      if (!draft.profile || !draft.product || !notice.data?.noticeVersion || !notice.data.text) return
      const body: QuoteRequestIn = {
        profile: draft.profile, productSlug: draft.product, needs: draft.needs,
        context: draft.context || undefined, desiredStartOn: draft.desiredDate || undefined,
        situation: draft.situation, firstName: draft.firstName, lastName: draft.lastName,
        phone: draft.phone, email: draft.email, city: draft.city, preferredContact: draft.contactMethod,
        noticeVersion: notice.data.noticeVersion, acknowledged: true,
      }
      submission.current = { body, key: crypto.randomUUID() }
    }
    inFlight.current = true
    setBusy(true)
    setFailure('')
    try {
      const result = await api.submitQuote(submission.current.body, submission.current.key)
      if (!result?.reference) throw new Error('Référence manquante.')
      setReceipt({ ...result, title: selected?.title ?? '' })
      setUncertain(false)
      submission.current = null
      focusHeading()
    } catch (error) {
      // When the result is unknown, retry the same payload and key before editing it.
      const retrySameRequest = !(error instanceof ApiError) || error.status >= 500 || error.status === 429
      setUncertain(retrySameRequest)
      if (!retrySameRequest) submission.current = null
      setFailure(retrySameRequest ? 'La confirmation n’a pas pu être reçue. Réessayez cet envoi pour conserver la même référence.' : businessError(error))
      if (error instanceof ApiError && error.code === 'NOTICE_CHANGED') {
        setDraft(previous => ({ ...previous, acknowledged: false }))
        notice.reload()
      } else if (error instanceof ApiError && error.code === 'PRODUCT_UNAVAILABLE') {
        setDraft(previous => ({ ...previous, product: '', context: '', acknowledged: false }))
        reload()
        changeStep(0)
      } else if (error instanceof ApiError && Object.keys(error.fields ?? {}).length > 0) {
        const fields = error.fields ?? {}
        const destination = fields.needs || fields.desiredStartOn || fields.context ? 1 : 2
        changeStep(destination)
        setErrors({ ...fields, desiredDate: fields.desiredStartOn })
      }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  function restart() {
    setDraft(initialDraft(query))
    setReceipt(undefined)
    setFailure('')
    changeStep(0)
    reload()
    notice.reload()
  }

  return (
    <div className="grid gap-4">
      {!receipt && (
        <ol aria-label="Étapes de la demande" className="grid grid-cols-4 gap-2">
          {steps.map((label, index) => (
            <li key={label} aria-current={step === index ? 'step' : undefined} className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded border p-2 text-sm font-semibold lg:flex-col lg:items-start lg:gap-0.5 lg:p-3 ${index === step ? 'border-primary bg-primary-tint text-primary' : 'border-line bg-white text-muted'}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs lg:hidden ${index <= step ? 'bg-primary text-white' : 'bg-surface-tint text-muted'}`}>{index + 1}</span>
              <span className="hidden text-xs lg:block">Étape {index + 1}</span>
              <span className="sr-only lg:not-sr-only">{label}</span>
            </li>
          ))}
        </ol>
      )}
      {receipt ? (
        <div role="status" className="grid justify-items-center gap-4 py-4 text-center sm:p-6">
          <ClipboardCheck size={48} className="text-primary" strokeWidth={1.5} aria-hidden />
          <h2 tabIndex={-1} ref={heading} className="text-2xl font-bold text-primary">Votre demande de devis a bien été envoyée.</h2>
          <p className="text-primary">Référence de votre demande : <strong className="wrap-anywhere">{receipt.reference}</strong></p>
          {receipt.title && <p>{receipt.title}</p>}
          <p className="max-w-md leading-7 text-muted">Conservez votre référence. Un conseiller pourra vous recontacter pour étudier votre besoin. Pour joindre l’agence, appelez le <a className="text-link" href={company.office.href}>{company.office.number}</a>.</p>
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={restart}>Nouvelle demande</Button><ActionLink to="/" variant="secondary">Retour à l’accueil</ActionLink></div>
        </div>
      ) : (
        <form className="grid gap-4 py-1 sm:gap-5" onSubmit={advance}>
          <div>
            <p className="mb-1 text-sm font-semibold text-secondary">Étape {step + 1} sur {steps.length}</p>
            <h2 tabIndex={-1} ref={heading} className="text-xl font-bold">{step === 3 ? 'Récapitulatif de votre demande' : steps[step]}</h2>
          </div>
          {step === 0 && loading && !products.length && <LoadingState />}
          {step === 0 && error && <ErrorState>Le catalogue ne peut pas être chargé. <Button variant="secondary" onClick={reload}>Réessayer</Button></ErrorState>}
          {step === 0 && !loading && !error && !products.length && <p className="text-muted">Aucune assurance n’est disponible pour le moment.</p>}
          {step === 3 && notice.loading && <LoadingState />}
          {step === 3 && !notice.loading && (!notice.data?.noticeVersion || notice.error) && !uncertain && <ErrorState>
            La notice de confidentialité est indisponible. <Button variant="secondary" onClick={notice.reload}>Réessayer</Button>
          </ErrorState>}
          <fieldset disabled={busy || uncertain} className="grid min-w-0 gap-4">
            <QuoteFields step={step} draft={draft} errors={errors} update={update} products={products} notice={notice.data} />
          </fieldset>
          {failure && <ErrorState>{failure}</ErrorState>}
          <div className="flex flex-wrap gap-3 border-t border-line pt-4 sm:justify-between">
            {step > 0 && !uncertain && <Button variant="secondary" disabled={busy} onClick={() => { setFailure(''); changeStep(step - 1) }}>Précédent</Button>}
            <Button type="submit" disabled={busy || (step === 0 && !products.length) || (step === 3 && !uncertain && (notice.loading || !notice.data?.noticeVersion))}
              className="sm:ml-auto">{busy ? 'Envoi…' : uncertain ? 'Réessayer l’envoi' : step === 3 ? 'Envoyer ma demande' : step === 2 ? 'Vérifier ma demande' : 'Continuer'}</Button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function QuoteRequest() {
  const company = useCompany()
  const [query] = useSearchParams()
  return (
    <div className="site-container grid items-start gap-6 py-8 lg:grid-cols-[minmax(0,2.08fr)_minmax(0,1fr)] lg:gap-8 lg:py-12">
      <section className="panel grid gap-5 p-4 sm:p-6 lg:gap-6 lg:p-8">
        <div className="grid gap-2 border-b border-line pb-5">
          <h1 className="text-2xl/8 font-bold tracking-tight text-primary lg:text-[32px]/10">Demander un devis personnalisé</h1>
          <p className="text-sm leading-6 text-muted">Décrivez vos besoins et vérifiez votre demande en quatre étapes. Aucun compte n’est nécessaire.</p>
        </div>
        <QuoteWizard query={query} key={query.toString()} />
      </section>
      <aside aria-label="Aide à la demande" className="grid gap-4 lg:gap-6">
        <ContentCard title="Besoin d’aide ?" icon={Headset}>
          <p>Appelez l’agence pour parler de votre besoin.</p>
          <a href={company.office.href} className="text-link mt-2 block">{company.office.number}</a>
          <a href={company.assistance.href} className="text-link mt-1 block">Assistance · {company.assistance.number}</a>
        </ContentCard>
        <ContentCard title="Engagements de confidentialité" icon={ShieldCheck}>Aucun compte ou renseignement médical n’est nécessaire pour préparer une demande.</ContentCard>
      </aside>
    </div>
  )
}
