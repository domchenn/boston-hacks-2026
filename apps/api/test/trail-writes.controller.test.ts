/**
 * HTTP tests for POST /v1/trails and PUT /v1/trails/:id with save_trail() stubbed:
 * sign-in required, body validation (unknown keys, bad enums), 201/200 with the id,
 * absent keys passed through as absent, and save_trail() errors mapped to
 * 422/403 with their message. Rules against a real database are in
 * test/integration/trail-writes.rls.test.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TrailWritesService } from '../src/trails/trail-writes.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const ID = '5eed0000-0000-4000-8000-000000000001'
const body = { title: 'Walk', status: 'draft', stops: [{ place_name: 'A', crumb: 'Look up' }] }
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: TrailWritesService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(TrailWritesService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const send = (method: 'POST' | 'PUT', payload: unknown, url = '/v1/trails', signedIn = true) =>
  app.inject({ method, url, payload: payload as object, headers: signedIn ? { authorization: `Bearer ${token}` } : {} })

describe('POST /v1/trails', () => {
  it('requires sign-in', async () => {
    expect((await send('POST', body, '/v1/trails', false)).statusCode).toBe(401)
  })

  it('creates and answers 201 with the id, passing the body as-is', async () => {
    const save = vi.spyOn(service, 'save').mockResolvedValue({ id: ID })
    const res = await send('POST', body)
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ id: ID })
    expect(save).toHaveBeenCalledWith(body, null, expect.objectContaining({ id: USER_ID }))
    expect(save.mock.calls[0][0]).not.toHaveProperty('community_id')
  })

  it.each([
    ['an unknown key', { ...body, creator_id: USER_ID }],
    ['a bad status', { ...body, status: 'archived' }],
    ['no stops list', { title: 'x', status: 'draft' }],
    ['a bad travel mode', { ...body, stops: [{ place_name: 'A', travel_mode_to_stop: 'ferry' }] }],
  ])('rejects %s with 400 before calling the database', async (_label, payload) => {
    const save = vi.spyOn(service, 'save')
    const res = await send('POST', payload)
    expect(res.statusCode).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })

  it("passes save_trail()'s rule message through as 422", async () => {
    vi.spyOn(service, 'save').mockRejectedValue(new UnprocessableEntityException('Add at least 2 stops before publishing'))
    const res = await send('POST', { ...body, status: 'published' })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: 'unprocessable_entity', message: 'Add at least 2 stops before publishing' })
  })
})

describe('PUT /v1/trails/:id', () => {
  it('replaces and answers 200 with the id', async () => {
    const save = vi.spyOn(service, 'save').mockResolvedValue({ id: ID })
    const res = await send('PUT', body, `/v1/trails/${ID}`)
    expect(res.statusCode).toBe(200)
    expect(save).toHaveBeenCalledWith(body, ID, expect.objectContaining({ id: USER_ID }))
  })

  it('rejects a non-uuid id', async () => {
    expect((await send('PUT', body, '/v1/trails/abc')).statusCode).toBe(400)
  })

  it("someone else's trail is 403 with save_trail()'s message", async () => {
    vi.spyOn(service, 'save').mockRejectedValue(new ForbiddenException('Trail not found, or it isn’t yours'))
    const res = await send('PUT', body, `/v1/trails/${ID}`)
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ error: 'forbidden' })
  })
})
