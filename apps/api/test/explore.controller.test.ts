/**
 * HTTP tests for Explore, badges and communities with the data layer stubbed:
 * which routes need sign-in, query and body validation, routing to the services
 * with the verified user (or none), and the response shapes.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { UnprocessableEntityException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { CommunitiesService } from '../src/communities/communities.service.js'
import { ExploreService } from '../src/explore/explore.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL = '5eed0000-0000-4000-8000-000000000001'
const COMMUNITY = '5eed0000-0000-4000-8000-0000000000b1'
let supabase: FakeSupabase
let app: NestFastifyApplication
let explore: ExploreService
let communities: CommunitiesService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  explore = app.get(ExploreService)
  communities = app.get(CommunitiesService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const call = (method: 'GET' | 'PUT', url: string, { signedIn = true, payload }: { signedIn?: boolean; payload?: object } = {}) =>
  app.inject({ method, url, headers: signedIn ? { authorization: `Bearer ${token}` } : {}, ...(payload ? { payload } : {}) })

describe('sign-in', () => {
  it.each([
    ['GET', '/v1/trending'],
    ['GET', '/v1/me/finished-trails'],
    ['PUT', '/v1/me/community'],
  ] as const)('%s %s requires sign-in', async (method, url) => {
    expect((await call(method, url, { signedIn: false, payload: method === 'PUT' ? { communityId: null } : undefined })).statusCode).toBe(401)
  })

  it('neighborhoods and communities work signed out', async () => {
    const hoods = vi.spyOn(explore, 'neighborhoods').mockResolvedValue(['Allston'])
    const list = vi.spyOn(communities, 'list').mockResolvedValue([])
    expect((await call('GET', '/v1/neighborhoods', { signedIn: false })).json()).toEqual({ neighborhoods: ['Allston'] })
    expect((await call('GET', '/v1/communities', { signedIn: false })).json()).toEqual({ communities: [] })
    expect(hoods).toHaveBeenCalledWith(null)
    expect(list).toHaveBeenCalledWith(null)
  })
})

describe('trending', () => {
  it('passes days and limit as numbers for the verified user', async () => {
    const trending = vi.spyOn(explore, 'trending').mockResolvedValue([{ trailId: TRAIL, score: 7, people: 2 }])
    const res = await call('GET', '/v1/trending?days=7&limit=10')
    expect(res.json()).toEqual({ trails: [{ trailId: TRAIL, score: 7, people: 2 }] })
    expect(trending).toHaveBeenCalledWith({ days: 7, limit: 10 }, expect.objectContaining({ id: USER_ID }))
  })

  it.each(['days=0', 'days=91', 'limit=101', 'limit=-1', 'days=1.5', 'sort=new'])('rejects ?%s with 400', async (query) => {
    expect((await call('GET', `/v1/trending?${query}`)).statusCode).toBe(400)
  })
})

describe('badges', () => {
  it('lists your finished trails', async () => {
    const finished = { completedAt: '2026-11-20T12:00:00Z', line: 'rl' as const, neighborhood: 'Allston' }
    const spy = vi.spyOn(explore, 'finishedTrails').mockResolvedValue([finished])
    expect((await call('GET', '/v1/me/finished-trails')).json()).toEqual({ trails: [finished] })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }))
  })
})

describe('my community', () => {
  it('joins and leaves for the verified user', async () => {
    const set = vi.spyOn(communities, 'setMine').mockImplementation(async (communityId) => communityId)
    expect((await call('PUT', '/v1/me/community', { payload: { communityId: COMMUNITY } })).json()).toEqual({ communityId: COMMUNITY })
    expect((await call('PUT', '/v1/me/community', { payload: { communityId: null } })).json()).toEqual({ communityId: null })
    expect(set).toHaveBeenNthCalledWith(1, COMMUNITY, expect.objectContaining({ id: USER_ID }))
  })

  it.each([{}, { communityId: 'bu' }, { communityId: null, userId: USER_ID }])('rejects %j with 400', async (payload) => {
    expect((await call('PUT', '/v1/me/community', { payload })).statusCode).toBe(400)
  })

  it('an unknown community is a 422 with a readable message', async () => {
    vi.spyOn(communities, 'setMine').mockRejectedValue(new UnprocessableEntityException('That community doesn’t exist anymore.'))
    const res = await call('PUT', '/v1/me/community', { payload: { communityId: COMMUNITY } })
    expect(res.statusCode).toBe(422)
    expect(res.json().message).toBe('That community doesn’t exist anymore.')
  })
})
