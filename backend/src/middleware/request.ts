import { randomUUID } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import type { z } from 'zod'
import { ApiError } from './errors.js'

export const trackRequest: RequestHandler = (request, response, next) => {
  const start = performance.now()
  const requestId = randomUUID()
  response.locals.requestId = requestId
  response.set('X-Request-ID', requestId)
  response.on('finish', () => {
    const route = request.route as { path?: unknown } | undefined
    console.info(JSON.stringify({
      event: 'http_request',
      requestId,
      method: request.method,
      route: typeof route?.path === 'string' ? route.path : 'unmatched',
      status: response.statusCode,
      durationMs: Math.round(performance.now() - start),
    }))
  })
  next()
}

export function sameOrigin(origin: string): RequestHandler {
  return (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) { next(); return }
    const browserOrigin = request.get('Origin')
    let allowed = browserOrigin === origin
    if (browserOrigin === undefined) {
      try { allowed = new URL(request.get('Referer') ?? '').origin === origin }
      catch { allowed = false }
    }
    if (!allowed) throw new ApiError(403, 'CSRF_FAILED', 'Origine de la requête non autorisée.')
    next()
  }
}

export function jsonBody<S extends z.ZodRawShape>(request: Request, schema: z.ZodObject<S>) {
  if (!request.is('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Utilisez le format JSON.')
  }
  const result = schema.safeParse(request.body)
  if (result.success) return result.data
  const fields: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && Object.hasOwn(schema.shape, field)) fields[field] = 'Valeur invalide.'
  }
  throw new ApiError(422, 'VALIDATION_FAILED', 'Vérifiez les champs du formulaire.', fields)
}
