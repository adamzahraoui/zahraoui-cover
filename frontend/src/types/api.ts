import type { ProductSlug } from '../config/navigation'

export type Profile = 'INDIVIDUAL' | 'BUSINESS'
export type Situation = 'NEW_POLICY' | 'RENEWAL' | 'SWITCH_PROVIDER'
export type ContactMethod = 'PHONE' | 'EMAIL'
export type RequestStatus = 'NEW' | 'IN_REVIEW' | 'QUOTE_SENT' | 'ACCEPTED' | 'DECLINED' | 'CLOSED'
export type AssistanceStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
export type MessageStatus = 'UNREAD' | 'READ' | 'PROCESSED'

export type ProductCard = {
  id: string
  slug: ProductSlug
  title: string
  summary: string
  audiences: Profile[]
  imageKey?: string
}
export type Product = ProductCard & {
  potentialCoverages: { title: string; description: string }[]
  eligibilityText: string
  documentHints: string[]
  faqs: { question: string; answer: string }[]
  relatedSlugs: ProductSlug[]
}

type Notice = { noticeVersion: string; acknowledged: true }
export type QuoteRequestIn = Notice & {
  profile: Profile
  productSlug: ProductSlug
  desiredStartOn?: string
  situation?: Situation
  needs: string
  context?: string
  firstName: string
  lastName: string
  phone: string
  email: string
  city: string
  preferredContact?: ContactMethod
}
export type ContactIn = Notice & { fullName: string; phone: string; email: string; subject: string; message: string }
export type AssistanceIn = Notice & { fullName: string; phone: string; productSlug: ProductSlug; contractReference?: string; description: string }
export type Receipt = { reference: string; receivedAt: string }
export type Auth = { id: string; email: string; displayName: string; role: 'ADVISOR' | 'ADMIN'; expiresAt: string; csrfToken: string }
export type ClientIn = { profile: Profile; displayName: string; phone: string; email?: string | null; city?: string | null; notes?: string | null }
export type Client = ClientIn & ClientOption & { createdAt: string; updatedAt: string }
export type ClientDetail = Client & { recentRequests: RequestRow[]; recentQuotes: IssuedQuoteRow[]; recentContracts: ContractRow[]; recentAssistance: Pick<AssistanceRow, 'id' | 'reference' | 'status' | 'createdAt'>[]; activity: ActivityEntry[] }
export type DuplicateClient = Pick<ClientOption, 'id' | 'displayName' | 'intakeProvisional' | 'archivedAt'>
export type ActivityEntry = { id: string; action: string; createdAt: string; actor: { displayName: string } | null }
export type MessageRow = { id: string; reference: string; fullName: string; subject: string; status: MessageStatus; createdAt: string; version: number; archivedAt: string | null }
export type Message = MessageRow & { phone: string; email: string; message: string; noticeVersion: string; acknowledgedAt: string; updatedAt: string }
export type AssistanceRow = { id: string; reference: string; fullName: string; productSlug: ProductSlug; status: AssistanceStatus; priority: 'NORMAL' | 'URGENT'; createdAt: string; version: number; assignedTo: string | null }
export type ContractOption = { id: string; reference: string; status: ContractStatus }
export type AssistanceCase = AssistanceRow & {
  phone: string; contractReference: string | null; description: string; noticeVersion: string; acknowledgedAt: string;
  productTitle: string; client: DuplicateClient | null; contract: ContractOption | null; assignee: StaffOption | null;
  allowedStatuses: AssistanceStatus[]; activity: ActivityEntry[]; notes: RequestDetail['notes']
}
export type AssistancePatch = { version: number; status?: AssistanceStatus; priority?: AssistanceRow['priority']; assignedTo?: string | null; clientId?: string | null; contractId?: string | null }
export type RequestRow = {
  id: string; reference: string; displayName: string; phone: string; productSlug: ProductSlug
  status: RequestStatus; assignedTo?: string; createdAt: string; version: number
}
export type RequestDetail = RequestRow & Omit<QuoteRequestIn, 'acknowledged' | 'preferredContact' | 'situation'> & {
  preferredContact: ContactMethod; situation: Situation; clientId?: string
  productTitle: string; client: LinkedClient | null; assignee: StaffOption | null; allowedStatuses: RequestStatus[]
  acknowledgedAt: string; updatedAt: string; notes: { id: string; authorName: string; body: string; createdAt: string }[]
}
export type Dashboard = {
  counts: { totalRequests: number; inReviewRequests: number; newRequests: number; openRequests: number; activeClients: number; openAssistance: number; unreadMessages: number; totalClients: number; provisionalClients: number; newAssistance: number; inReviewAssistance: number }
  recentRequests: RequestRow[]
  recentQuotes: IssuedQuoteRow[]
  quoteCounts: Partial<Record<QuoteStatus, number>>
  contractCounts: { total: number; active: number; draft: number; scheduled: number; expiring: number; expired: number; attention: number }
  recentContracts: ContractRow[]
  byProduct: { slug: ProductSlug; title: string; count: number }[]
  months: { month: string; count: number }[]
  activity: { id: string; action: string; targetId: string | null; targetType: string | null; createdAt: string }[]
}
export type StaffOption = { id: string; displayName: string }
export type ClientOption = {
  id: string; displayName: string; profile: Profile; phone: string; city: string | null
  intakeProvisional: boolean; archivedAt: string | null; version: number
}
export type LinkedClient = ClientOption & { email: string | null }
export type PageMeta = { page: number; limit: number; total: number }
export type Page<T> = { data: T[]; meta: PageMeta }
export type QuoteNotice = { noticeVersion: string | null; text: string | null }
export type CatalogWrite = Omit<Product, 'id' | 'slug' | 'imageKey'> & { isPublished: boolean; isActive: boolean; displayOrder: number; imageKey?: null }
export type CatalogItem = Product & { isPublished: boolean; isActive: boolean; displayOrder: number; version: number }
export type QuoteRequestPatch = { version: number; status?: RequestStatus; clientId?: string; assignedTo?: string | null }

export type ApiErrorBody = { code: string; message: string; fields?: Record<string, string>; requestId?: string }

export type QuoteStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'
export type DecisionMethod = 'EMAIL' | 'PHONE' | 'IN_PERSON' | 'LETTER'
export type OfferFields = {
  annualPremiumMad: string; feesMad: string; taxesMad: string; validUntil: string | null
  coverage: string | null; coverageLimits: string | null; deductibles: string | null; conditions: string | null
  internalNotes: string | null; customerNotes: string | null
}
export type IssuedQuoteInput = OfferFields & { clientId: string; requestId?: string | null; productSlug: ProductSlug; partnerId: string }
export type IssuedQuoteRow = {
  id: string; reference: string; clientId: string; clientName: string; requestId: string | null;
  partnerId: string; partnerName: string; productSlug: ProductSlug; productTitle: string; status: QuoteStatus;
  annualPremiumMad: string; totalMad: string; currency: 'MAD'; createdAt: string; issuedAt: string | null;
  sentAt: string | null; validUntil: string | null; version: number; revision: number
}
export type QuoteDocument = {
  id: string; createdAt: string; revision: number; quoteVersion: number | null;
  mimeType: 'application/pdf' | null; status: 'QUEUED' | 'READY' | 'FAILED';
  delivery: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null
}
export type IssuedQuote = IssuedQuoteRow & OfferFields & {
  client: { email: string | null; intakeProvisional: boolean; archivedAt: string | null }
  requestReference: string | null
  documents: QuoteDocument[]
  revisions: Pick<IssuedQuoteRow, 'id' | 'reference' | 'revision' | 'status'>[]
  decidedAt: string | null; decisionMethod: DecisionMethod | null; decisionEvidence: string | null
  decisionActor: { displayName: string } | null; hasNext: boolean; pdfEnabled: boolean; deliveryEnabled: boolean
}

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'CANCELLED' | 'UNVERIFIED'
export type PolicyFields = {
  policyNumber: string | null; effectiveOn: string; expiresOn: string;
  coverage: string | null; premiumMad: string | null; internalNotes: string | null; renewalReminders: boolean
}
export type ContractRow = {
  id: string; clientId: string; clientName: string; quoteId: string | null; quoteReference: string | null;
  partnerId: string; partnerName: string; productSlug: ProductSlug; productTitle: string; reference: string;
  status: ContractStatus; version: number; createdAt: string; currency: 'MAD';
  previousId: string | null; successorId: string | null; successorReference: string | null; renewed: boolean; confirmed: boolean
} & Pick<PolicyFields, 'policyNumber' | 'effectiveOn' | 'expiresOn' | 'premiumMad' | 'renewalReminders'>
export type ContractDetail = ContractRow & PolicyFields & {
  confirmationReference: string | null; confirmationOn: string | null; confirmer: { displayName: string } | null;
  cancelledAt: string | null; cancellationReason: string | null; uploadEnabled: boolean; reminderDeliveryEnabled: boolean
  previous: { id: string; reference: string; expiresOn: string } | null
  documents: { id: string; revision: number; createdAt: string; mimeType: string | null }[]
  renewalHistory: { id: string; reference: string; status: ContractStatus; activatedAt: string | null }[]
  activity: ActivityEntry[]
  reminders: { id: string; days: number | null; expiresOn: string | null; status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'OBSOLETE'; nextAttemptAt: string; finishedAt: string | null }[]
}

export type PartnerRow = {
  id: string; name: string; displayName: string | null; categories: ProductSlug[];
  isActive: boolean; isPublished: boolean; verifiedAt: string | null; version: number
}
export type PartnerInput = {
  name: string; displayName: string | null; contactPerson: string | null; phone: string | null; email: string | null;
  website: string | null; address: string | null; internalNotes: string | null; categories: ProductSlug[]
}
export type PartnerDetail = PartnerRow & Omit<PartnerInput, 'name' | 'displayName' | 'categories'> & {
  verificationReference: string | null; verifier: { displayName: string } | null
  recentQuotes: IssuedQuoteRow[]; recentContracts: ContractRow[]; activity: ActivityEntry[]
}
export type PublicPartner = { name: string; website: string | null }

export type DocumentKind = 'QUOTE_PDF' | 'CONTRACT_PDF' | 'CONTRACT_SUPPORT' | 'BUSINESS_PDF'
type DocumentClient = { id: string; displayName: string }
export type DocumentRow = {
  id: string; name: string; kind: DocumentKind; status: 'QUEUED' | 'READY' | 'FAILED'
  sizeBytes: string | null; version: number; revision: number; quoteVersion: number | null
  createdAt: string; readyAt: string | null; archivedAt: string | null; client: DocumentClient | null
  quote: { id: string; reference: string } | null; contract: { id: string; reference: string } | null
  canPreview: boolean; canArchive: boolean
}
export type DocumentDetail = DocumentRow & {
  uploader: { displayName: string } | null; mimeType: string | null; activity: ActivityEntry[]
}
export type DocumentPage = Page<DocumentRow> & { storage: { count: number; sizeBytes: string }; uploadEnabled: boolean }
