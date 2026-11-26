/**
 * HTTP tests for the caller's trail rating with the data layer stubbed: sign-in
 * required, uuid and body validation (1–5 whole scores, review length, no extra
 * keys), routing to the service with the verified user, and the 422 / 403 messages.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { RatingsService } from '../src/ratings/ratings.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL = '5eed0000-0000-4000-8000-000000000001'
const URL = `/v1/me/trails/${TRAIL}/rating`
const BODY = { price: 4, time: 3, enjoyment: 5, memorability: 5, review: 'Lovely walk' }
const RATING = { id: '5eed0000-0000-4000-8000-0000000000a1', ...BODY, createdAt: '2026-11-26T12:00:00.000Z' }
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: RatingsService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(RatingsService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const call = (method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: unknown, signedIn = true) =>
  app.inject({
    method,
    url,
    headers: signedIn ? { authorization: `Bearer ${token}` } : {},
    ...(payload !== undefined ? { payload: payload as object } : {}),
  })

describe('trail rating', () => {
  it.each(['GET', 'PUT', 'DELETE'] as const)('%s requires sign-in', async (method) => {
    expect((await call(method, URL, method === 'PUT' ? BODY : undefined, false)).statusCode).toBe(401)
  })

  it('reads your rating, or null', async () => {
    const get = vi.spyOn(service, 'get').mockResolvedValueOnce(RATING).mockResolvedValueOnce(null)
    expect((await call('GET', URL)).json()).toEqual({ rating: RATING })
    expect((await call('GET', URL)).json()).toEqual({ rating: null })
    expect(get).toHaveBeenCalledWith(TRAIL, expect.objectContaining({ id: USER_ID }))
  })

  it('saves a rating for the verified user and answers with it', async () => {
    const rate = vi.spyOn(service, 'rate').mockResolvedValue(RATING)
    const res = await call('PUT', URL, BODY)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ rating: RATING })
    expect(rate).toHaveBeenCalledWith(TRAIL, BODY, expect.objectContaining({ id: USER_ID }))
  })

  it('deletes your rating', async () => {
    const remove = vi.spyOn(service, 'remove').mockResolvedValue()
    const res = await call('DELETE', URL)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ rating: null })
    expect(remove).toHaveBeenCalledWith(TRAIL, expect.objectContaining({ id: USER_ID }))
  })

  it.each([
    ['a score of 0', { ...BODY, price: 0 }],
    ['a score of 6', { ...BODY, time: 6 }],
    ['a half star', { ...BODY, enjoyment: 4.5 }],
    ['a missing score', { price: 1, time: 1, enjoyment: 1 }],
    ['a review over 2000 characters', { ...BODY, review: 'x'.repeat(2001) }],
    ['someone else’s user id', { ...BODY, user_id: '5eed0000-0000-4000-8000-0000000000ff' }],
  ])('rejects %s with 400 before touching the database', async (_label, body) => {
    const rate = vi.spyOn(service, 'rate')
    expect((await call('PUT', URL, body)).statusCode).toBe(400)
    expect(rate).not.toHaveBeenCalled()
  })

  it('rejects a bad trail id with 400', async () => {
    expect((await call('GET', '/v1/me/trails/abc/rating')).statusCode).toBe(400)
  })

  it.each([
    [new UnprocessableEntityException('Finish this trail first, then you can rate it.'), 422],
    [new ForbiddenException('You made this trail, so you can’t rate it.'), 403],
  ])('passes the rule message through (%s)', async (error, status) => {
    vi.spyOn(service, 'rate').mockRejectedValue(error)
    const res = await call('PUT', URL, BODY)
    expect(res.statusCode).toBe(status)
    expect(res.json().message).toBe(error.message)
  })
})
