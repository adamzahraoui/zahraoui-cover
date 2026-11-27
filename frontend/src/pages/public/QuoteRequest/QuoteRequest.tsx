import { ClipboardCheck, Headset, ShieldCheck } from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContentCard } from '../../../components/public/PublicSections'
import { ActionLink, Button } from '../../../components/ui/Button'
import { company } from '../../../config/company'
import { QuoteFields } from './QuoteFields'
import { initialDraft, steps, validateStep } from './quoteForm'
import type { QuoteDraft, QuoteErrors } from './quoteForm'

function QuoteWizard({ query }: { query: URLSearchParams }) {
  const [draft, setDraft] = useState(() => initialDraft(query))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<QuoteErrors>({})
  const [preview, setPreview] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  function focusHeading() {
    requestAnimationFrame(() => heading.current?.focus())
  }

  function update(changes: Partial<QuoteDraft>) {
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

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateStep(step, draft)
    setErrors(validation)
    const field = Object.keys(validation)[0]
    if (field) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
      return
    }
    if (step < steps.length - 1) changeStep(step + 1)
    else {
      setPreview(true)
      focusHeading()
    }
  }

  function restart() {
    setDraft(initialDraft(query))
    setPreview(false)
    changeStep(0)
  }

  return (
    <div className="grid gap-4">
      {!preview && (
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
      {preview ? (
        <div className="grid justify-items-center gap-4 py-4 text-center sm:p-6">
          <ClipboardCheck size={48} className="text-primary" strokeWidth={1.5} aria-hidden />
          <h2 tabIndex={-1} ref={heading} className="text-2xl font-bold text-primary">Aperçu de confirmation</h2>
          <p className="max-w-md leading-7 text-muted">Les étapes du formulaire sont complètes. Aucune demande n’a été envoyée et aucune référence n’a été créée.</p>
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={restart}>Nouvelle demande</Button><ActionLink to="/" variant="secondary">Retour à l’accueil</ActionLink></div>
        </div>
      ) : (
        <form className="grid gap-4 py-1 sm:gap-5" onSubmit={advance}>
          <div>
            <p className="mb-1 text-sm font-semibold text-secondary">Étape {step + 1} sur {steps.length}</p>
            <h2 tabIndex={-1} ref={heading} className="text-xl font-bold">{step === 3 ? 'Récapitulatif de votre demande' : steps[step]}</h2>
          </div>
          <QuoteFields step={step} draft={draft} errors={errors} update={update} />
          <div className="flex flex-wrap gap-3 border-t border-line pt-4 sm:justify-between">
            {step > 0 && <Button variant="secondary" onClick={() => changeStep(step - 1)}>Précédent</Button>}
            <Button type="submit" className="sm:ml-auto">{step === 3 ? 'Prévisualiser la confirmation' : step === 2 ? 'Vérifier ma demande' : 'Continuer'}</Button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function QuoteRequest() {
  const [query] = useSearchParams()
  return (
    <div className="site-container grid items-start gap-6 py-8 lg:grid-cols-[minmax(0,2.08fr)_minmax(0,1fr)] lg:gap-8 lg:py-12">
      <section className="panel grid gap-5 p-4 sm:p-6 lg:gap-6 lg:p-8">
        <div className="grid gap-2 border-b border-line pb-5">
          <h1 className="text-2xl/8 font-bold tracking-tight text-primary lg:text-[32px]/10">Demander un devis personnalisé</h1>
          <p className="text-sm leading-6 text-muted">Décrivez vos besoins et vérifiez votre demande en quatre étapes. Aucun compte n’est nécessaire.</p>
        </div>
        <p className="rounded border border-blue-200 bg-primary-tint p-3 text-sm leading-6 text-primary">Démonstration. Utilisez des données fictives. Ce formulaire n’envoie aucune demande.</p>
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
