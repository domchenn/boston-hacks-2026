/**
 * Production-only behaviour: the interactive docs page is off, while the OpenAPI
 * JSON stays available for client generation.
 */
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { startTestApp } from './support/test-app.js'

let app: NestFastifyApplication

beforeAll(async () => {
  app = await startTestApp({
    NODE_ENV: 'production',
    APP_ENV: 'production',
    CORS_ORIGINS: 'https://breadcrumb.boston',
    SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  })
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
