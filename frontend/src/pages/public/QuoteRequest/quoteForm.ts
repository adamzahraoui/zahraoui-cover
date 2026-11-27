import type { ProductSlug } from '../../../config/navigation'
import { parseProduct } from '../../../data/insurance'
import type { ContactMethod, Profile, Situation } from '../../../types/api'
import { casablancaToday, validEmail, validPhone } from '../../../utils/forms'

export type QuoteDraft = {
  profile: Profile | ''
  product: ProductSlug | ''
  context: string
  desiredDate: string
  situation: Situation
  needs: string
  firstName: string
  lastName: string
  phone: string
  email: string
  city: string
  contactMethod: ContactMethod
  acknowledged: boolean
}

export type QuoteErrors = Partial<Record<keyof QuoteDraft, string>>

export const steps = ['Votre assurance', 'Vos besoins', 'Vos coordonnées', 'Vérification'] as const
export const situations = [
  { value: 'NEW_POLICY', label: 'Nouveau contrat' },
  { value: 'RENEWAL', label: 'Renouvellement ou comparaison' },
  { value: 'SWITCH_PROVIDER', label: 'Changement d’assureur' },
]
export const contactMethods = [{ value: 'PHONE', label: 'Téléphone' }, { value: 'EMAIL', label: 'Email' }]

export function initialDraft(query: URLSearchParams): QuoteDraft {
  const profile = query.get('profil')
  return {
    profile: profile === 'professionnel' ? 'BUSINESS' : profile === 'particulier' ? 'INDIVIDUAL' : '',
    product: parseProduct(query.get('type')),
    context: '',
    desiredDate: '',
    situation: 'NEW_POLICY',
    needs: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    contactMethod: 'PHONE',
    acknowledged: false,
  }
}

export function validateStep(step: number, draft: QuoteDraft): QuoteErrors {
  const errors: QuoteErrors = {}
  if (step === 0) {
    if (!draft.profile) errors.profile = 'Sélectionnez votre profil.'
    if (!draft.product) errors.product = 'Sélectionnez une assurance.'
  }
  if (step === 1) {
    if (draft.needs.trim().length < 10) errors.needs = 'Décrivez votre besoin en au moins 10 caractères.'
    if (draft.desiredDate && draft.desiredDate < casablancaToday()) errors.desiredDate = 'Choisissez une date à partir d’aujourd’hui.'
  }
  if (step === 2) {
    if (draft.firstName.trim().length < 2) errors.firstName = 'Saisissez au moins deux caractères.'
    if (draft.lastName.trim().length < 2) errors.lastName = 'Saisissez au moins deux caractères.'
    if (!validPhone(draft.phone)) errors.phone = 'Indiquez un numéro marocain ou international valide.'
    if (!validEmail(draft.email)) errors.email = 'Saisissez une adresse email valide.'
    if (draft.city.trim().length < 2) errors.city = 'Saisissez au moins deux caractères.'
  }
  if (step === 3 && !draft.acknowledged) errors.acknowledged = 'Lisez la notice puis cochez la case.'
  return errors
}
