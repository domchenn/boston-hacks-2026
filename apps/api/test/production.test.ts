/**
 * Production-only behaviour: the interactive docs page is off, while the OpenAPI
 * JSON stays available for client generation.
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from '../src/config/env.js'
import { createApp } from '../src/create-app.js'

let app: NestFastifyApplication

beforeAll(async () => {
  app = await createApp(
    loadConfig({ NODE_ENV: 'production', APP_ENV: 'production', LOG_LEVEL: 'silent', CORS_ORIGINS: 'https://breadcrumb.boston' }),
  )
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
})

afterAll(async () => {
  await app.close()
})

it('hides the docs page in production', async () => {
  const res = await app.inject({ method: 'GET', url: '/docs' })
  expect(res.statusCode).toBe(404)
})

it('still serves the OpenAPI JSON in production', async () => {
  const res = await app.inject({ method: 'GET', url: '/v1/openapi.json' })
  expect(res.statusCode).toBe(200)
})
