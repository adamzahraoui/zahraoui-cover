import type { AssistanceIn, Auth, CatalogItem, CatalogWrite, ClientOption, ContactIn, Dashboard, Page, Product, ProductCard, QuoteNotice, QuoteRequestIn, QuoteRequestPatch, Receipt, RequestDetail, RequestRow, StaffOption } from '../types/api'
import type { ProductSlug } from '../config/navigation'

export class ApiError extends Error {
  constructor(public status: number, public code: string, public fields?: Record<string, string>, public summary?: string) {
    super(code)
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin' })
  if (response.status === 401 && path.startsWith('/admin/')) window.dispatchEvent(new Event('zc:session-expired'))
  if (response.status === 204) return undefined as T
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new ApiError(response.status, 'UNEXPECTED_RESPONSE')
  }

  if (!response.ok) {
    const failure: { error?: { code?: string; message?: string; fields?: Record<string, string> } } = await response.json()
    throw new ApiError(response.status, failure.error?.code ?? 'HTTP_ERROR', failure.error?.fields, failure.error?.message)
  }

  return await response.json() as T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await fetchJson<{ data: T } | undefined>(path, init)
  return result?.data as T
}

function list<T>(path: string, query: string, signal?: AbortSignal) {
  return fetchJson<Page<T>>(query ? `${path}?${query}` : path, { signal })
}

function patch<T>(path: string, body: object, csrfToken: string) {
  return request<T>(path, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  })
}

export function businessError(error: unknown) {
  return error instanceof ApiError && error.summary
    ? error.summary
    : 'Le service est temporairement indisponible. Réessayez dans un instant.'
}

function post<T>(path: string, body?: object, headers?: Record<string, string>) {
  return request<T>(path, {
    method: 'POST',
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Auth, catalog and quote requests share the same-origin API.
export const api = {
  catalog: (audience?: 'INDIVIDUAL' | 'BUSINESS', signal?: AbortSignal) =>
    request<ProductCard[]>(audience ? `/catalog?audience=${audience}` : '/catalog', { signal }),
  product: (slug: ProductSlug, signal?: AbortSignal) => request<Product>(`/catalog/${slug}`, { signal }),
  quoteNotice: (signal?: AbortSignal) => request<QuoteNotice>('/quotes/notice', { signal }),
  adminCatalog: (signal?: AbortSignal) => request<CatalogItem[]>('/admin/catalog', { signal }),
  adminProduct: (id: string, signal?: AbortSignal) => request<CatalogItem>('/admin/catalog/' + encodeURIComponent(id), { signal }),
  createProduct: (body: CatalogWrite & { slug: ProductSlug }, csrf: string) => post<CatalogItem>('/admin/catalog', body, { 'X-CSRF-Token': csrf }),
  updateProduct: (id: string, body: Partial<CatalogWrite> & { version: number }, csrf: string) => patch<CatalogItem>('/admin/catalog/' + encodeURIComponent(id), body, csrf),
  quoteRequests: (query: string, signal?: AbortSignal) => list<RequestRow>('/admin/quote-requests', query, signal),
  quoteRequest: (id: string, signal?: AbortSignal) => request<RequestDetail>('/admin/quote-requests/' + encodeURIComponent(id), { signal }),
  updateQuoteRequest: (id: string, body: QuoteRequestPatch, csrf: string) => patch<RequestDetail>('/admin/quote-requests/' + encodeURIComponent(id), body, csrf),
  addQuoteNote: (id: string, body: { version: number; body: string }, csrf: string) => post<RequestDetail>('/admin/quote-requests/' + encodeURIComponent(id) + '/notes', body, { 'X-CSRF-Token': csrf }),
  staffOptions: (query: string, signal?: AbortSignal) => list<StaffOption>('/admin/staff-options', query, signal),
  clientOptions: (query: string, signal?: AbortSignal) => list<ClientOption>('/admin/clients', query, signal),
  dashboard: (signal?: AbortSignal) => request<Dashboard>('/admin/dashboard', { signal }),
  submitQuote: (input: QuoteRequestIn, key: string) => post<Receipt>('/quotes', input, { 'Idempotency-Key': key }),
  submitContact: (input: ContactIn, key: string) => post<Receipt>('/contact', input, { 'Idempotency-Key': key }),
  submitAssistance: (input: AssistanceIn, key: string) => post<Receipt>('/assistance', input, { 'Idempotency-Key': key }),
  session: (signal?: AbortSignal) => request<Auth>('/auth/session', { signal }),
  login: (body: { email: string; password: string }) => post<Auth>('/auth/login', body),
  logout: (csrfToken: string) => post<void>('/auth/logout', undefined, { 'X-CSRF-Token': csrfToken }),
  changePassword: (body: { currentPassword: string; newPassword: string }, csrfToken: string) =>
    post<void>('/auth/change-password', body, { 'X-CSRF-Token': csrfToken }),
  forgotPassword: (email: string) => post<{ accepted: true }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => post<void>('/auth/reset-password', { token, password }),
}
