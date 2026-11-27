import { Prisma } from '@prisma/client'
import type { ErrorRequestHandler } from 'express'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

function parserError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('type' in error)) return
  switch (error.type) {
    case 'entity.too.large': return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Le contenu est trop volumineux.')
    case 'entity.parse.failed':
    case 'request.size.invalid':
    case 'request.aborted': return new ApiError(400, 'MALFORMED_REQUEST', 'Requête invalide.')
    case 'encoding.unsupported':
    case 'charset.unsupported': return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Format de contenu non pris en charge.')
  }
}

export const handleError: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) { next(error); return }
  const known = error instanceof ApiError ? error : parserError(error)
  const unavailable = error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ['P1000', 'P1001', 'P1002', 'P1017', 'P2024', 'P2037'].includes(error.code))
  const failure = known ?? (unavailable
    ? new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service temporairement indisponible.')
    : new ApiError(500, 'INTERNAL_ERROR', 'Une erreur est survenue.'))
  if (!known) {
    console.error(JSON.stringify({ event: 'request_failure', requestId: response.locals.requestId, method: request.method, code: failure.code }))
  }
  response.status(failure.status).json({
    error: {
      code: failure.code,
      message: failure.message,
      fields: failure.fields,
      requestId: response.locals.requestId,
    },
  })
}
