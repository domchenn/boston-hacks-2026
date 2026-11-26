/**
 * End-to-end tests of the API skeleton through Fastify's in-memory inject (no port):
 * health, meta, request IDs, CORS allow/deny, the error format and OpenAPI.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from '../src/config/env.js'
import { createApp } from '../src/create-app.js'

const ALLOWED = 'https://breadcrumb-staging-seven.vercel.app'
let app: NestFastifyApplication

beforeAll(async () => {
  app = await createApp(loadConfig({ NODE_ENV: 'test', APP_ENV: 'staging', LOG_LEVEL: 'silent', CORS_ORIGINS: ALLOWED }))
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
})

afterAll(async () => {
  await app.close()
})

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /v1/meta', () => {
  it('reports name, version and the configured environment', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/meta' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ name: 'breadcrumb-api', version: '0.1.0', environment: 'staging' })
  })
})

describe('request IDs', () => {
  it('generates one when the caller sends none', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses a safe caller ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'trace-123' } })
    expect(res.headers['x-request-id']).toBe('trace-123')
  })

  it('replaces an unsafe caller ID instead of trusting it', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'bad id\nforged' } })
    expect(res.headers['x-request-id']).not.toContain('bad')
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('CORS', () => {
  it('allows a listed origin, including preflight', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/meta',
      headers: { origin: ALLOWED, 'access-control-request-method': 'GET' },
    })
    expect(res.statusCode).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
  })

  it('gives an unlisted origin no CORS permission', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/meta', headers: { origin: 'https://evil.example' } })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('errors', () => {
  it('returns the standard shape for an unknown route', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope', headers: { 'x-request-id': 'trace-404' } })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'not_found', message: 'Cannot GET /nope', requestId: 'trace-404' })
  })

  it('returns the standard shape for a malformed JSON body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/meta',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'bad_request', requestId: expect.any(String) })
  })
})

describe('OpenAPI', () => {
  it('serves a document that lists the endpoints', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/openapi.json' })
    expect(res.statusCode).toBe(200)
    const doc = res.json()
    expect(doc.info).toMatchObject({ title: 'Breadcrumb API', version: '0.1.0' })
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/health', '/v1/meta']))
  })
})
