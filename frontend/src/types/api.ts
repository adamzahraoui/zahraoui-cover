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
export type ClientIn = { profile: Profile; displayName: string; phone: string; email?: string; city?: string; notes?: string }
export type Client = ClientIn & { id: string; version: number; createdAt: string; updatedAt: string; archivedAt?: string }
export type RequestRow = {
  id: string; reference: string; displayName: string; phone: string; productSlug: ProductSlug
  status: RequestStatus; assignedTo?: string; createdAt: string; version: number
}
export type RequestDetail = RequestRow & Omit<QuoteRequestIn, 'acknowledged' | 'preferredContact' | 'situation'> & {
  preferredContact: ContactMethod; situation: Situation; clientId?: string
  acknowledgedAt: string; updatedAt: string; notes: { id: string; authorName: string; body: string; createdAt: string }[]
}
export type Dashboard = {
  counts: { newRequests: number; openRequests: number; activeClients: number; openAssistance: number; unreadMessages: number }
  recentRequests: RequestRow[]
}
export type ApiErrorBody = { code: string; message: string; fields?: Record<string, string>; requestId?: string }
