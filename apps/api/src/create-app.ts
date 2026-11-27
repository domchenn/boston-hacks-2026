/**
 * Builds the configured API app without starting it, so main.ts and the tests share
 * one setup: Fastify with Pino JSON logging (Nest's own messages included), request IDs, the CORS allow-list, the error
 * filter and the OpenAPI document (served at /v1/openapi.json; docs page at /docs
 * outside production). JSON bodies are capped at 1 MB; image bodies (photo uploads)
 * arrive as a Buffer and may be up to 5 MB.
 */
import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { IncomingMessage } from 'node:http'
import { LogController } from 'fastify'
import { AppModule } from './app.module.js'
import { ErrorFilter } from './common/error.filter.js'
import { MAX_UPLOAD_BYTES } from './photos/image-cleaner.js'
import { PinoNestLogger } from './common/pino-nest-logger.js'
import type { AppConfig } from './config/env.js'
import { API_VERSION } from './version.js'

const REQUEST_ID_HEADER = 'x-request-id'
/** Accept a caller's request ID only if it is short and plain, so it can't inject log lines. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/

export function requestIdFor(req: IncomingMessage): string {
  const incoming = req.headers[REQUEST_ID_HEADER]
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()
}

export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    genReqId: requestIdFor,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    trustProxy: config.NODE_ENV === 'production',
    bodyLimit: 1_048_576,
  })

  // bufferLogs holds Nest's startup messages until they can go through Pino as JSON.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), adapter, {
    bufferLogs: true,
  })

  const fastify = app.getHttpAdapter().getInstance()
  app.useLogger(new PinoNestLogger(fastify.log))
  // Photo uploads send the image itself as the body; the photos module checks and cleans it.
  fastify.addContentTypeParser(/^image\//, { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES }, (_request, body, done) => done(null, body))
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id)
  })

  const allowed = new Set(config.CORS_ORIGINS)
  app.enableCors({
    origin: (origin, callback) => callback(null, origin === undefined || allowed.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: 600,
  })

  app.useGlobalFilters(new ErrorFilter())

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Breadcrumb API')
      .setDescription('REST API for Breadcrumb clients.')
      .setVersion(API_VERSION)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Supabase access token' })
      .build(),
  )
  fastify.get('/v1/openapi.json', async () => document)
  if (config.NODE_ENV !== 'production') SwaggerModule.setup('docs', app, document, { raw: false })

  return app
}
