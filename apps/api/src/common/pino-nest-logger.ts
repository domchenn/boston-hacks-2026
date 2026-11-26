/**
 * Sends NestJS's own log messages (startup, route mapping, errors) through Fastify's
 * Pino logger, so every API log line is JSON with the same fields.
 */
import type { LoggerService } from '@nestjs/common'
import type { FastifyBaseLogger } from 'fastify'

export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: FastifyBaseLogger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message))
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error({ context, stack }, String(message))
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message))
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message))
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message))
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message))
  }
}
