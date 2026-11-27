import { BriefcaseBusiness, UserRound } from 'lucide-react'
import { NoticeCheckbox } from '../../../components/public/NoticeCheckbox'
import { Input, Select, Textarea } from '../../../components/ui/Fields'
import { getInsurance, parseProduct, productOptions } from '../../../data/insurance'
import type { ContactMethod, Situation } from '../../../types/api'
import { casablancaToday } from '../../../utils/forms'
import { contactMethods, situations } from './quoteForm'
import type { QuoteDraft, QuoteErrors } from './quoteForm'

type Props = {
  step: number
  draft: QuoteDraft
  errors: QuoteErrors
  update: (changes: Partial<QuoteDraft>) => void
}

const profiles = [
  { value: 'INDIVIDUAL', label: 'Particulier', icon: UserRound },
  { value: 'BUSINESS', label: 'Professionnel / Entreprise', icon: BriefcaseBusiness },
] as const

function Review({ draft }: { draft: QuoteDraft }) {
  const fields = [
    ['Profil', profiles.find(item => item.value === draft.profile)?.label],
    ['Assurance', draft.product ? getInsurance(draft.product).label : ''],
    ['Contexte', draft.context],
    ['Date d’effet souhaitée', draft.desiredDate],
    ['Situation', situations.find(item => item.value === draft.situation)?.label],
    ['Besoins', draft.needs],
    ['Nom et prénom', `${draft.lastName} ${draft.firstName}`],
    ['Téléphone', draft.phone],
    ['Email', draft.email],
    ['Ville', draft.city],
    ['Mode de contact', contactMethods.find(item => item.value === draft.contactMethod)?.label],
  ]
  return (
    <dl className="grid gap-x-5 gap-y-4 rounded border border-line bg-background p-4 sm:grid-cols-2">
      {fields.filter(([, value]) => value).map(([name, value]) => (
        <div key={name} className={`min-w-0 ${name === 'Besoins' ? 'sm:col-span-2' : ''}`}>
          <dt className="text-sm text-muted">{name}</dt>
          <dd className="mt-0.5 font-medium wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function QuoteFields({ step, draft, errors, update }: Props) {
  const product = draft.product ? getInsurance(draft.product) : undefined
  if (step === 0) {
    return (
      <>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">Vous êtes *</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {profiles.map(({ value, label, icon: Icon }) => (
              <label key={value} className="flex min-h-14 items-center gap-2 rounded border border-line-strong bg-white p-3 has-checked:border-primary has-checked:bg-primary-tint">
                <input type="radio" name="profile" value={value} checked={draft.profile === value} onChange={() => update({ profile: value })} required className="size-4 shrink-0 accent-primary" />
                <Icon size={18} className="shrink-0 text-primary" aria-hidden /><span className="text-sm font-semibold">{label}</span>
              </label>
            ))}
          </div>
          {errors.profile && <p className="text-sm text-danger">{errors.profile}</p>}
        </fieldset>
        <Select label="Catégorie d’assurance souhaitée" name="product" value={draft.product} required placeholder="Sélectionner une assurance" options={productOptions} error={errors.product} onChange={event => update({ product: parseProduct(event.target.value), context: '' })} />
      </>
    )
  }
  if (step === 1) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Date d’effet souhaitée (facultatif)" name="desiredDate" type="date" min={casablancaToday()} value={draft.desiredDate} error={errors.desiredDate} onChange={event => update({ desiredDate: event.target.value })} />
          <Select label="Situation actuelle" name="situation" options={situations} value={draft.situation} onChange={event => update({ situation: event.target.value as Situation })} />
        </div>
        {product && <Select label={`${product.contextLabel} (facultatif)`} name="context" options={product.contexts.map(label => ({ label, value: label }))} value={draft.context} placeholder="Préciser si utile" onChange={event => update({ context: event.target.value })} />}
        <Textarea label="Précisions sur vos besoins" name="needs" hint="Décrivez votre besoin général. N’indiquez aucun renseignement médical ou document d’identité." value={draft.needs} required minLength={10} maxLength={1000} error={errors.needs} onChange={event => update({ needs: event.target.value })} />
      </>
    )
  }
  if (step === 2) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nom" name="lastName" value={draft.lastName} required minLength={2} maxLength={120} error={errors.lastName} onChange={event => update({ lastName: event.target.value })} autoComplete="off" />
        <Input label="Prénom" name="firstName" value={draft.firstName} required minLength={2} maxLength={120} error={errors.firstName} onChange={event => update({ firstName: event.target.value })} autoComplete="off" />
        <Input label="Téléphone" name="phone" type="tel" value={draft.phone} required maxLength={24} error={errors.phone} onChange={event => update({ phone: event.target.value })} autoComplete="off" placeholder="+212 600 000 000" />
        <Input label="Email" name="email" type="email" value={draft.email} required maxLength={254} error={errors.email} onChange={event => update({ email: event.target.value })} autoComplete="off" />
        <Input label="Ville" name="city" value={draft.city} required minLength={2} maxLength={100} error={errors.city} onChange={event => update({ city: event.target.value })} />
        <Select label="Mode de contact préféré" name="contactMethod" options={contactMethods} value={draft.contactMethod} onChange={event => update({ contactMethod: event.target.value as ContactMethod })} />
      </div>
    )
  }
  return (
    <>
      <Review draft={draft} />
      <NoticeCheckbox checked={draft.acknowledged} onChange={event => update({ acknowledged: event.target.checked })} />
      {errors.acknowledged && <p className="text-sm text-danger">{errors.acknowledged}</p>}
    </>
  )
}
