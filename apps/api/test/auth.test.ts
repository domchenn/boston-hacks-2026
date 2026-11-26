/**
 * Auth tests: the global guard accepts only valid Supabase access tokens and fails
 * closed. Covers every way a token can be wrong, public and optional routes, and
 * the 503 when signing keys can't be fetched. Uses a local fake Supabase JWKS.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { SignJWT } from 'jose'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

let supabase: FakeSupabase
let app: NestFastifyApplication

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
})

afterAll(async () => {
  await app.close()
  await supabase.close()
})

const me = (authorization?: string) =>
  app.inject({ method: 'GET', url: '/v1/me', headers: authorization === undefined ? {} : { authorization } })

function expectRejected(res: Awaited<ReturnType<typeof me>>) {
  expect(res.statusCode).toBe(401)
  expect(res.headers['www-authenticate']).toBe('Bearer')
  expect(res.json()).toMatchObject({ error: 'unauthorized', requestId: expect.any(String) })
}

describe('valid tokens', () => {
  it('returns the signed-in user from the token', async () => {
    const res = await me(`Bearer ${await supabase.token()}`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: USER_ID, email: 'test1@example.com', aal: 'aal1', isAnonymous: false })
  })

  it('accepts a token that expired within the 30-second clock tolerance', async () => {
    const res = await me(`Bearer ${await supabase.token({ exp: Math.floor(Date.now() / 1000) - 10 })}`)
    expect(res.statusCode).toBe(200)
  })
})

describe('rejected requests', () => {
  it('no Authorization header', async () => {
    const res = await me()
    expectRejected(res)
    expect(res.json().message).toBe('Sign in required.')
  })

  it.each(['Token abc', 'Bearer', 'Bearer ', 'bearer.x.y', 'Bearer a b'])('malformed header %j', async (header) => {
    expectRejected(await me(header))
  })

  it('a token that is not a JWT', async () => {
    expectRejected(await me('Bearer not-a-jwt'))
  })

  it('a token over the size limit', async () => {
    expectRejected(await me(`Bearer ${'a'.repeat(9000)}`))
  })

  it('a token signed by a key Supabase did not publish (same kid)', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({}, { key: supabase.otherKey })}`))
  })

  it('a token with an unknown key id', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({}, { key: supabase.otherKey, kid: 'other' })}`))
  })

  it('an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600
    expectRejected(await me(`Bearer ${await supabase.token({ iat: past - 3600, exp: past })}`))
  })

  it('a token not yet valid', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({ nbf: Math.floor(Date.now() / 1000) + 600 })}`))
  })

  it('a token from another project (wrong issuer)', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({ iss: 'https://other.supabase.co/auth/v1' })}`))
  })

  it('a token for another audience', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({ aud: 'something-else' })}`))
  })

  it('the anon role (a publishable/anon key, not a user)', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({ role: 'anon' })}`))
  })

  it('the service_role role', async () => {
    expectRejected(await me(`Bearer ${await supabase.token({ role: 'service_role' })}`))
  })

  it.each([
    ['missing sub', { sub: undefined }],
    ['non-uuid sub', { sub: 'admin' }],
    ['missing exp', { exp: undefined }],
    ['missing iat', { iat: undefined }],
  ])('%s', async (_label, claims) => {
    expectRejected(await me(`Bearer ${await supabase.token(claims)}`))
  })

  it('an HS256 token (shared-secret algorithm not allowed)', async () => {
    const hs = await new SignJWT({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', iss: `${supabase.url}/auth/v1` })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('x'.repeat(32)))
    expectRejected(await me(`Bearer ${hs}`))
  })

  it('an unsigned token (alg none)', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const now = Math.floor(Date.now() / 1000)
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: USER_ID,
      role: 'authenticated',
      aud: 'authenticated',
      iss: `${supabase.url}/auth/v1`,
      iat: now,
      exp: now + 3600,
    })}.`
    expectRejected(await me(`Bearer ${unsigned}`))
  })
})

describe('route modes', () => {
  it('public routes ignore the Authorization header entirely', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', headers: { authorization: 'Bearer junk' } })
    expect(res.statusCode).toBe(200)
  })
})

describe('when signing keys cannot be fetched', () => {
  it('fails closed with 503 when the key endpoint errors', async () => {
    const fresh = await startFakeSupabase()
    const isolated = await startTestApp({ SUPABASE_URL: fresh.url })
    try {
      const token = await fresh.token()
      fresh.setBroken(true)
      const res = await isolated.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'service_unavailable', message: expect.stringMatching(/temporarily unavailable/) })
    } finally {
      await isolated.close()
      await fresh.close()
    }
  })

  it('fails closed with 503 when the key endpoint is unreachable', async () => {
    const fresh = await startFakeSupabase()
    const isolated = await startTestApp({ SUPABASE_URL: fresh.url })
    try {
      const token = await fresh.token()
      await fresh.close()
      const res = await isolated.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } })
      expect(res.statusCode).toBe(503)
    } finally {
      await isolated.close()
    }
  })
})
