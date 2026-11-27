export const publicNavigation = [
  { to: '/', label: 'Accueil' },
  { to: '/assurances', label: 'Nos assurances' },
  { to: '/particuliers', label: 'Particuliers' },
  { to: '/professionnels', label: 'Professionnels' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
] as const

export const insuranceNavigation = [
  { slug: 'automobile', label: 'Assurance automobile' },
  { slug: 'habitation', label: 'Assurance habitation' },
  { slug: 'sante', label: 'Assurance santé' },
  { slug: 'voyage', label: 'Assurance voyage' },
  { slug: 'professionnelle', label: 'Assurance professionnelle' },
  { slug: 'responsabilite-civile', label: 'Responsabilité civile' },
] as const

export type ProductSlug = typeof insuranceNavigation[number]['slug']

export const policyNavigation = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/politique-de-confidentialite', label: 'Politique de confidentialité' },
  { to: '/politique-de-cookies', label: 'Politique de cookies' },
] as const
