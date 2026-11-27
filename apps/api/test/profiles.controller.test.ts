/**
 * HTTP tests for the profile and my-list endpoints with the data layer stubbed:
 * id/username validation, 404 for unknown profiles, sign-in required for /v1/me
 * lists, the status filter, and that the verified user (or null) reaches the service.
 * RLS behaviour against a real database is in test/integration/profiles.rls.test.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ProfileStats, PublicProfile, SavedTrailList } from '@breadcrumb/contracts'
import { ProfilesService } from '../src/profiles/profiles.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const profile: PublicProfile = {
  id: USER_ID,
  username: 'test1',
  display_name: 'Test One',
  avatar_url: null,
  bio: null,
  is_private: false,
  community: null,
}

let supabase: FakeSupabase
let app: NestFastifyApplication
let service: ProfilesService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(ProfilesService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const get = (url: string, signedIn = false) =>
  app.inject({ method: 'GET', url, headers: signedIn ? { authorization: `Bearer ${token}` } : {} })

describe('GET /v1/profiles/:handle', () => {
  it.each([USER_ID, 'test1'])('accepts an id or a username (%s)', async (handle) => {
    const lookup = vi.spyOn(service, 'getProfile').mockResolvedValue(profile)
    const res = await get(`/v1/profiles/${handle}`)
    expect(res.statusCode).toBe(200)
    expect(PublicProfile.parse(res.json())).toEqual(profile)
    expect(lookup).toHaveBeenCalledWith(handle, null)
  })

  it('answers 404 for an unknown profile', async () => {
    vi.spyOn(service, 'getProfile').mockResolvedValue(null)
    expect((await get('/v1/profiles/nobody_here')).statusCode).toBe(404)
  })

  it.each(['ab', 'Has-Caps', 'a'.repeat(31)])('rejects an invalid handle (%s) with 400', async (handle) => {
    const lookup = vi.spyOn(service, 'getProfile')
    expect((await get(`/v1/profiles/${handle}`)).statusCode).toBe(400)
    expect(lookup).not.toHaveBeenCalled()
  })
})

describe('GET /v1/profiles/:id/stats and /made-trails', () => {
  it('passes the signed-in user to the stats', async () => {
    const stats = vi
      .spyOn(service, 'getStats')
      .mockResolvedValue({ questgiverRating: { average: 4.5, count: 2 }, madeCount: 3, finishedCount: 1 })
    const res = await get(`/v1/profiles/${USER_ID}/stats`, true)
    expect(ProfileStats.parse(res.json()).madeCount).toBe(3)
    expect(stats).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ id: USER_ID }))
  })

  it('needs a uuid, not a username', async () => {
    expect((await get('/v1/profiles/test1/made-trails')).statusCode).toBe(400)
  })
})

describe('GET /v1/me/trails and /v1/me/saved-trails', () => {
  it.each(['/v1/me/trails?status=saved', '/v1/me/saved-trails'])('require sign-in (%s)', async (url) => {
    const res = await get(url)
    expect(res.statusCode).toBe(401)
  })

  it('pass the status filter and the user', async () => {
    const mine = vi.spyOn(service, 'getMyTrails').mockResolvedValue([])
    const res = await get('/v1/me/trails?status=completed', true)
    expect(res.statusCode).toBe(200)
    expect(mine).toHaveBeenCalledWith('completed', expect.objectContaining({ id: USER_ID }))
  })

  it.each(['', '?status=aborted', '?status=saved&extra=1'])('reject a missing or invalid status (%s)', async (qs) => {
    expect((await get(`/v1/me/trails${qs}`, true)).statusCode).toBe(400)
  })

  it('returns the saved list in the contract shape', async () => {
    vi.spyOn(service, 'getSavedTrails').mockResolvedValue([])
    const res = await get('/v1/me/saved-trails', true)
    expect(SavedTrailList.parse(res.json())).toEqual({ trails: [] })
  })
})
