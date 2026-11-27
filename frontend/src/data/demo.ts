import type { ProductSlug } from '../config/navigation'
import type { ClientIn, RequestStatus } from '../types/api'

export type DemoClient = ClientIn & { id: string; archived?: boolean }
export type DemoRequest = {
  id: string; reference: string; name: string; phone: string; email: string; city: string
  product: ProductSlug; date: string; status: RequestStatus; needs: string
  assignee: string; clientId?: string; notes: string[]
}
export type QuoteStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'DECLINED'
export type DemoQuote = {
  id: string; reference: string; clientId: string; product: ProductSlug; partnerId: string
  premium: string; conditions: string; status: QuoteStatus; requestId?: string
}
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export type DemoContract = {
  id: string; reference: string; clientId: string; product: ProductSlug; partnerId: string
  policy: string; startOn: string; endOn: string; status: ContractStatus; quoteId?: string
}

export type DemoPartner = { id: string; name: string; active: boolean }
export type CatalogItem = { slug: ProductSlug; summary: string; published: boolean }
export type DemoSettings = { email: string; address: string; hours: string }

export const demoAdvisors = [
  { value: 'advisor-1', label: 'Conseiller démo A' },
  { value: 'advisor-2', label: 'Conseiller démo B' },
]
export const demoClients: DemoClient[] = [
  { id: '1', profile: 'INDIVIDUAL', displayName: 'Client démo 01', phone: '0600000001', email: 'client01@example.invalid', city: 'Casablanca' },
  { id: '2', profile: 'BUSINESS', displayName: 'Client démo 02', phone: '0600000002', email: 'client02@example.invalid', city: 'Rabat' },
  { id: '3', profile: 'INDIVIDUAL', displayName: 'Client démo 03', phone: '0600000003', city: 'Tanger' },
]

const scenarios: { product: ProductSlug; status: RequestStatus; date: string }[] = [
  { product: 'automobile', status: 'NEW', date: '2026-11-21' },
  { product: 'professionnelle', status: 'IN_REVIEW', date: '2026-11-20' },
  { product: 'habitation', status: 'QUOTE_SENT', date: '2026-11-19' },
  { product: 'voyage', status: 'ACCEPTED', date: '2026-10-12' },
  { product: 'responsabilite-civile', status: 'DECLINED', date: '2026-10-09' },
  { product: 'sante', status: 'CLOSED', date: '2026-10-05' },
  { product: 'automobile', status: 'NEW', date: '2026-09-24' },
  { product: 'habitation', status: 'IN_REVIEW', date: '2026-09-20' },
  { product: 'voyage', status: 'NEW', date: '2026-09-16' },
]

export const demoRequests: DemoRequest[] = scenarios.map((scenario, index) => ({
  ...scenario,
  id: String(index + 1),
  reference: `DM-DÉMO-${(index + 1).toString().padStart(3, '0')}`,
  name: `Client démo ${(index + 1).toString().padStart(2, '0')}`,
  phone: `060000000${index + 1}`,
  email: `client${index + 1}@example.invalid`,
  city: index === 1 ? 'Rabat' : 'Casablanca',
  needs: 'Exemple de demande de renseignements sur les garanties possibles et les conditions du contrat.',
  assignee: index === 1 ? 'advisor-1' : '',
  clientId: index < 2 ? String(index + 1) : undefined,
  notes: [],
}))

export const demoQuotes: DemoQuote[] = [
  { id: '1', reference: 'DV-DÉMO-001', clientId: '1', product: 'automobile', partnerId: '', premium: '3200.00', conditions: 'Exemple de contenu. Les garanties réelles restent à confirmer.', status: 'ISSUED' },
  { id: '2', reference: 'DV-DÉMO-002', clientId: '2', product: 'professionnelle', partnerId: '', premium: '4500.00', conditions: 'Exemple de conditions de dossier.', status: 'ACCEPTED', requestId: '2' },
]

export const demoContracts: DemoContract[] = [
  { id: '1', reference: 'CTR-DÉMO-001', clientId: '1', product: 'automobile', partnerId: '', policy: 'POL-DÉMO-001', startOn: '2026-02-01', endOn: '2027-02-01', status: 'ACTIVE' },
  { id: '2', reference: 'CTR-DÉMO-002', clientId: '2', product: 'professionnelle', partnerId: '', policy: 'POL-DÉMO-002', startOn: '2025-01-15', endOn: '2026-01-15', status: 'EXPIRED' },
]
