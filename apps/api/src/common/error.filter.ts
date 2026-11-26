/**
 * Turns every error into one JSON shape: { error, message, requestId }. Known HTTP
 * errors keep their status and message (401s also get WWW-Authenticate: Bearer); anything unexpected becomes a 500 with a
 * generic message and is logged with its stack (never sent to the client).
 */
import { ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

export type ErrorBody = { error: string; message: string; requestId: string }

const STATUS_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
  429: 'too_many_requests',
  503: 'service_unavailable',
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<FastifyRequest>()
    const reply = http.getResponse<FastifyReply>()

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Something went wrong.'
    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const response = exception.getResponse()
      const raw = typeof response === 'string' ? response : (response as { message?: unknown }).message
      message = Array.isArray(raw) ? raw.join('; ') : typeof raw === 'string' ? raw : exception.message
    } else if (isFastifyClientError(exception)) {
      status = exception.statusCode
      message = exception.message
    }

    if (status >= 500 && status !== 503) request.log.error({ err: exception }, 'request failed')
    if (status === 401) void reply.header('www-authenticate', 'Bearer')

    const body: ErrorBody = {
      error: STATUS_CODES[status] ?? (status >= 500 ? 'internal_error' : 'error'),
      message: status >= 500 && status !== 503 ? 'Something went wrong.' : message,
      requestId: String(request.id),
    }
    void reply.status(status).send(body)
  }
}

/** Fastify's own 4xx errors (for example a malformed JSON body) carry a statusCode. */
function isFastifyClientError(error: unknown): error is { statusCode: number; message: string } {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { statusCode?: unknown }).statusCode
  return typeof code === 'number' && code >= 400 && code < 500
}
