import type { AssistanceIn, Auth, ContactIn, Product, ProductCard, QuoteRequestIn, Receipt } from '../types/api'
import type { ProductSlug } from '../config/navigation'

export class ApiError extends Error {
  constructor(public status: number, public code: string, public fields?: Record<string, string>) {
    super(code)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin' })
  if (response.status === 204) return undefined as T
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new ApiError(response.status, 'UNEXPECTED_RESPONSE')
  }

  if (!response.ok) {
    const failure: { error?: { code?: string; fields?: Record<string, string> } } = await response.json()
    throw new ApiError(response.status, failure.error?.code ?? 'HTTP_ERROR', failure.error?.fields)
  }

  const result: { data: T } = await response.json()
  return result.data
}

function post<T>(path: string, body?: object, headers?: Record<string, string>) {
  return request<T>(path, {
    method: 'POST',
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Authentication is connected. Catalog and intake calls are prepared for the next phase.
export const api = {
  catalog: (audience?: 'INDIVIDUAL' | 'BUSINESS', signal?: AbortSignal) =>
    request<ProductCard[]>(audience ? `/catalog?audience=${audience}` : '/catalog', { signal }),
  product: (slug: ProductSlug, signal?: AbortSignal) => request<Product>(`/catalog/${slug}`, { signal }),
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
