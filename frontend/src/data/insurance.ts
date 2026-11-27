import { BriefcaseBusiness, CarFront, HeartPulse, House, Plane, Scale } from 'lucide-react'
import { insuranceNavigation } from '../config/navigation'
import type { ProductSlug } from '../config/navigation'
import type { Profile } from '../types/api'
import type { LucideIcon } from 'lucide-react'

type InsuranceReference = {
  icon: LucideIcon
  summary: string
  audiences: Profile[]
  potential: string[]
  audienceText: string
  documents: string
  question: string
  answer: string
  contextLabel: string
  contexts: string[]
}

const references: Record<ProductSlug, InsuranceReference> = {
  automobile: {
    icon: CarFront,
    summary: 'Des solutions pour votre véhicule personnel ou votre flotte professionnelle.',
    audiences: ['INDIVIDUAL', 'BUSINESS'],
    potential: ['Responsabilité civile', 'Dommages et collision', 'Vol, incendie et bris de glace', 'Assistance routière'],
    audienceText: 'Conducteurs particuliers et professionnels souhaitant protéger un véhicule ou plusieurs véhicules.',
    documents: 'Le conseiller peut vous indiquer les justificatifs relatifs au véhicule lors de l’étude du dossier.',
    question: 'Puis-je demander un devis pour plusieurs véhicules ?',
    answer: 'Précisez qu’il s’agit de plusieurs véhicules dans votre demande pour orienter votre entretien avec un conseiller.',
    contextLabel: 'Type de véhicule',
    contexts: ['Véhicule personnel', 'Véhicule professionnel', 'Flotte de véhicules'],
  },
  habitation: {
    icon: House,
    summary: 'Étudiez les possibilités de protection pour votre logement et vos biens.',
    audiences: ['INDIVIDUAL'],
    potential: ['Incendie et dégâts des eaux', 'Vol et vandalisme', 'Responsabilité civile du foyer', 'Assistance habitation'],
    audienceText: 'Propriétaires et locataires souhaitant étudier la protection de leur logement.',
    documents: 'Les caractéristiques générales du logement aident votre conseiller à préciser les informations nécessaires.',
    question: 'L’assurance habitation concerne-t-elle aussi les locataires ?',
    answer: 'Les locataires peuvent demander conseil sur les couvertures correspondant à leur logement et à leur situation.',
    contextLabel: 'Type de logement',
    contexts: ['Appartement', 'Maison', 'Autre logement'],
  },
  sante: {
    icon: HeartPulse,
    summary: 'Découvrez les pistes de couverture santé pour particuliers et entreprises.',
    audiences: ['INDIVIDUAL', 'BUSINESS'],
    potential: ['Consultations et pharmacie', 'Hospitalisation', 'Optique et dentaire', 'Couverture collective'],
    audienceText: 'Particuliers et entreprises qui recherchent des informations générales sur la couverture santé.',
    documents: 'La demande en ligne ne requiert aucun document ni renseignement médical.',
    question: 'Dois-je indiquer des informations médicales dans la demande ?',
    answer: 'Non. Indiquez seulement le type de couverture recherché et vos coordonnées de contact.',
    contextLabel: 'Type de couverture recherché',
    contexts: ['Individuelle', 'Familiale', 'Collective'],
  },
  voyage: {
    icon: Plane,
    summary: 'Préparez vos déplacements et renseignez-vous sur les couvertures possibles.',
    audiences: ['INDIVIDUAL', 'BUSINESS'],
    potential: ['Frais à l’étranger', 'Assistance et rapatriement', 'Bagages et retards', 'Attestation pour visa'],
    audienceText: 'Voyageurs particuliers et professionnels à la recherche d’une couverture adaptée à leur déplacement.',
    documents: 'Le conseiller peut préciser les informations utiles sur la destination et le séjour.',
    question: 'Quand se renseigner sur une assurance voyage ?',
    answer: 'Contactez un conseiller avant votre départ pour vérifier les conditions applicables à votre projet.',
    contextLabel: 'Type de déplacement',
    contexts: ['Voyage privé', 'Déplacement professionnel', 'Voyages récurrents'],
  },
  professionnelle: {
    icon: BriefcaseBusiness,
    summary: 'Explorez des solutions pour protéger votre activité, vos locaux et vos équipes.',
    audiences: ['BUSINESS'],
    potential: ['Multirisque des locaux', 'Flotte de véhicules', 'Perte d’exploitation', 'Responsabilité civile professionnelle'],
    audienceText: 'Entreprises et indépendants souhaitant évaluer les besoins liés à leur activité.',
    documents: 'Une description générale de l’activité permet de préparer l’entretien. Le conseiller précise les éventuels justificatifs.',
    question: 'Accompagnez-vous les indépendants ?',
    answer: 'Les indépendants peuvent demander une étude de leurs besoins en assurance professionnelle.',
    contextLabel: 'Type d’activité',
    contexts: ['Indépendant', 'PME', 'Autre entreprise'],
  },
  'responsabilite-civile': {
    icon: Scale,
    summary: 'Identifiez les solutions liées aux dommages causés à des tiers.',
    audiences: ['INDIVIDUAL', 'BUSINESS'],
    potential: ['Responsabilité civile vie privée', 'Responsabilité civile exploitation', 'Responsabilité civile professionnelle', 'Défense et recours'],
    audienceText: 'Particuliers et professionnels souhaitant se renseigner sur les risques liés à leur responsabilité.',
    documents: 'Votre conseiller peut vous demander de préciser le contexte privé ou professionnel lors de l’étude.',
    question: 'Quelle différence entre responsabilité civile privée et professionnelle ?',
    answer: 'La première concerne les situations de la vie privée. La seconde se rapporte à l’activité professionnelle selon les conditions du contrat.',
    contextLabel: 'Contexte de couverture',
    contexts: ['Vie privée', 'Exploitation', 'Activité professionnelle'],
  },
}

export const insurance = insuranceNavigation.map(product => ({ ...product, ...references[product.slug] }))
export type Insurance = typeof insurance[number]
export const productOptions = insuranceNavigation.map(({ slug, label }) => ({ value: slug, label }))

export function getInsurance(slug: ProductSlug) {
  const product = insurance.find(item => item.slug === slug)
  if (!product) throw new Error('Produit absent du catalogue local')
  return product
}

export function parseProduct(value: string | null): ProductSlug | '' {
  const aliases = { auto: 'automobile', pro: 'professionnelle', rc: 'responsabilite-civile' }
  const slug = value ? aliases[value as keyof typeof aliases] ?? value : ''
  return insurance.find(item => item.slug === slug)?.slug ?? ''
}
