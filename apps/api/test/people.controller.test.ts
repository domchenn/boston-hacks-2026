/**
 * HTTP tests for friends' activity and finding people with the data layer stubbed:
 * which routes need sign-in, query validation (ids, limits, unknown keys), the web's
 * default limits and routing with the verified user (or none).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PeopleService } from '../src/friends/people.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const A = '5eed0000-0000-4000-8000-0000000000a1'
const B = '5eed0000-0000-4000-8000-0000000000b1'
const PERSON = { id: A, username: 'sam', display_name: 'Sam', avatar_url: null }
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: PeopleService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(PeopleService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const get = (url: string, signedIn = true) => app.inject({ method: 'GET', url, headers: signedIn ? { authorization: `Bearer ${token}` } : {} })
const me = expect.objectContaining({ id: USER_ID })

describe('sign-in', () => {
  it.each(['/v1/me/friends-activity', '/v1/me/friends-also-saved', '/v1/people?q=sam', '/v1/me/suggested-people'])('%s requires sign-in', async (url) => {
    expect((await get(url, false)).statusCode).toBe(401)
  })

  it('trail cards work signed out', async () => {
    const cards = vi.spyOn(service, 'cards').mockResolvedValue([])
    expect((await get(`/v1/trail-cards?ids=${A},${B}`, false)).json()).toEqual({ trails: [] })
    expect(cards).toHaveBeenCalledWith([A, B], null)
  })
})

describe('validation', () => {
  it.each([
    '/v1/trail-cards',
    '/v1/trail-cards?ids=',
    '/v1/trail-cards?ids=abc',
    `/v1/trail-cards?ids=${Array.from({ length: 101 }, () => A).join(',')}`,
    '/v1/me/friends-activity?limit=0',
    '/v1/me/friends-activity?limit=101',
    '/v1/people',
    `/v1/people?q=${'x'.repeat(101)}`,
    '/v1/people?q=sam&limit=21',
    '/v1/me/suggested-people?limit=0',
    '/v1/me/suggested-people?sort=new',
  ])('%s is 400', async (url) => {
    expect((await get(url)).statusCode).toBe(400)
  })
})

describe('routing', () => {
  it('uses the web’s default limits and the verified user', async () => {
    const activity = vi.spyOn(service, 'activity').mockResolvedValue({ items: [], trails: [] })
    const search = vi.spyOn(service, 'search').mockResolvedValue([PERSON])
    const suggest = vi.spyOn(service, 'suggestions').mockResolvedValue([PERSON])
    expect((await get('/v1/me/friends-activity')).json()).toEqual({ items: [], trails: [] })
    expect((await get('/v1/people?q=sam')).json()).toEqual({ people: [PERSON] })
    expect((await get('/v1/me/suggested-people')).json()).toEqual({ people: [PERSON] })
    expect(activity).toHaveBeenCalledWith(30, me)
    expect(search).toHaveBeenCalledWith('sam', 8, me)
    expect(suggest).toHaveBeenCalledWith(6, me)
  })

  it('passes explicit limits and lists also-saved entries', async () => {
    const activity = vi.spyOn(service, 'activity').mockResolvedValue({ items: [], trails: [] })
    vi.spyOn(service, 'alsoSaved').mockResolvedValue([{ trailId: B, friend: PERSON }])
    await get('/v1/me/friends-activity?limit=12')
    expect(activity).toHaveBeenCalledWith(12, me)
    expect((await get('/v1/me/friends-also-saved')).json()).toEqual({ saves: [{ trailId: B, friend: PERSON }] })
  })
})
