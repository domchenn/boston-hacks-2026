/**
 * HTTP tests for the trail endpoints with the data layer stubbed: optional sign-in,
 * query and id validation, 404 for hidden trails, contract-shaped responses, and
 * that the verified user (or null) reaches the service. RLS behaviour against a
 * real database is covered by test/integration/trails.rls.test.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TrailDetail, TrailList, type FeedTrail } from '@breadcrumb/contracts'
import { TrailsService } from '../src/trails/trails.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL_ID = '5eed0000-0000-4000-8000-000000000001'
const card: FeedTrail = {
  id: TRAIL_ID,
  title: 'Sunday Café Hop',
  description: null,
  category: 'food_drink',
  customCategory: null,
  neighborhood: 'Beacon Hill',
  coverImageUrl: null,
  estimatedCost: 25,
  estimatedMinutes: 150,
  scheduledAt: null,
  primaryLine: 'gl',
  isCurated: true,
  createdAt: '2026-11-21T12:00:02+00:00',
  creator: null,
  stopCount: 0,
  crumbCount: 0,
  firstStopName: null,
  lastStopName: null,
  rating: { average: null, count: 0 },
  places: [],
}
const { places: _p, rating: _r, ...summary } = card
void _p
void _r
const detail: TrailDetail = {
  ...summary,
  status: 'published',
  visibility: 'public',
  communityId: null,
  remixedFrom: null,
  stops: [],
  betweenStopCrumbs: [],
  rating: { average: null, count: 0, price: null, time: null, enjoyment: null, memorability: null },
  reviews: [],
}

let supabase: FakeSupabase
let app: NestFastifyApplication
let service: TrailsService

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(TrailsService)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await app.close()
  await supabase.close()
})

describe('GET /v1/trails', () => {
  it('works signed out and passes a null user', async () => {
    const list = vi.spyOn(service, 'list').mockResolvedValue([card])
    const res = await app.inject({ method: 'GET', url: '/v1/trails' })
    expect(res.statusCode).toBe(200)
    expect(TrailList.parse(res.json())).toEqual({ trails: [card] })
    expect(list).toHaveBeenCalledWith({}, null)
  })

  it('passes the verified user and parsed filters', async () => {
    const list = vi.spyOn(service, 'list').mockResolvedValue([])
    const res = await app.inject({
      method: 'GET',
      url: '/v1/trails?category=outdoors&lateNight=true&maxCost=20',
      headers: { authorization: `Bearer ${await supabase.token()}` },
    })
    expect(res.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith(
      { category: 'outdoors', lateNight: true, maxCost: 20 },
      expect.objectContaining({ id: USER_ID }),
    )
  })

  it('rejects a bad token even though sign-in is optional', async () => {
    const list = vi.spyOn(service, 'list')
    const res = await app.inject({ method: 'GET', url: '/v1/trails', headers: { authorization: 'Bearer junk' } })
    expect(res.statusCode).toBe(401)
    expect(list).not.toHaveBeenCalled()
  })

  it.each(['colour=red', 'maxCost=-1', 'lateNight=yes', 'minCost=30&maxCost=10', 'category=nightlife'])(
    'rejects invalid filters (%s) with 400',
    async (qs) => {
      const list = vi.spyOn(service, 'list')
      const res = await app.inject({ method: 'GET', url: `/v1/trails?${qs}` })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'bad_request' })
      expect(list).not.toHaveBeenCalled()
    },
  )

  it('hides database errors behind a generic 500', async () => {
    vi.spyOn(service, 'list').mockRejectedValue(Object.assign(new Error('relation "x" does not exist'), { code: '42P01' }))
    const res = await app.inject({ method: 'GET', url: '/v1/trails' })
    expect(res.statusCode).toBe(500)
    expect(res.json().message).toBe('Something went wrong.')
  })
})

describe('GET /v1/trails/:id', () => {
  it('returns a visible trail', async () => {
    vi.spyOn(service, 'get').mockResolvedValue(detail)
    const res = await app.inject({ method: 'GET', url: `/v1/trails/${TRAIL_ID}` })
    expect(res.statusCode).toBe(200)
    expect(TrailDetail.parse(res.json())).toEqual(detail)
  })

  it('answers 404 when the trail is missing or hidden', async () => {
    vi.spyOn(service, 'get').mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: `/v1/trails/${TRAIL_ID}` })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'not_found', message: 'Trail not found.' })
  })

  it('rejects a non-uuid id with 400 before touching the database', async () => {
    const get = vi.spyOn(service, 'get')
    const res = await app.inject({ method: 'GET', url: '/v1/trails/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    expect(get).not.toHaveBeenCalled()
  })
})

describe('OpenAPI', () => {
  it('documents the trail endpoints from the shared contract', async () => {
    const doc = (await app.inject({ method: 'GET', url: '/v1/openapi.json' })).json()
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/v1/trails', '/v1/trails/{id}']))
    const ok = doc.paths['/v1/trails/{id}'].get.responses['200'].content['application/json'].schema
    expect(ok.properties).toHaveProperty('stops')
  })
})
