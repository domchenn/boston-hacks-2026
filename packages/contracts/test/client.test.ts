/**
 * Client tests with a stub fetch: URLs and query encoding, the bearer token,
 * response validation, 404 → null for one trail, and typed ApiError on failures.
 */
import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, RatingBody } from '../src/index.js'
import { feedTrail, trailDetail } from './fixtures.js'

function stubFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn<typeof fetch>(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    }),
  )
}

describe('createApiClient', () => {
  it('lists trails with encoded filters and the access token', async () => {
    const fetch = stubFetch(200, { trails: [feedTrail] })
    const client = createApiClient({ baseUrl: 'https://api.example/', getAccessToken: () => 'tok', fetch })
    const trails = await client.getTrails({ category: 'food_drink', lateNight: true, maxCost: 20, neighborhood: undefined })
    expect(trails).toEqual([feedTrail])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.example/v1/trails?category=food_drink&lateNight=true&maxCost=20')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('sends no Authorization header when signed out', async () => {
    const fetch = stubFetch(200, { trails: [] })
    await createApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => null, fetch }).getTrails()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.example/v1/trails')
    expect((init?.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('returns one trail, or null when the API says 404', async () => {
    const found = createApiClient({ baseUrl: 'https://api.example', fetch: stubFetch(200, trailDetail) })
    expect(await found.getTrail(trailDetail.id)).toEqual(trailDetail)
    const missing = createApiClient({
      baseUrl: 'https://api.example',
      fetch: stubFetch(404, { error: 'not_found', message: 'Trail not found.', requestId: 'r1' }),
    })
    expect(await missing.getTrail(trailDetail.id)).toBeNull()
  })

  it('turns an error body into a typed ApiError', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.example',
      fetch: stubFetch(401, { error: 'unauthorized', message: 'Sign in required.', requestId: 'r2' }),
    })
    await expect(client.getTrails()).rejects.toMatchObject({ status: 401, code: 'unauthorized', requestId: 'r2' })
    await expect(client.getTrails()).rejects.toBeInstanceOf(ApiError)
  })

  it('handles an error without a JSON body', async () => {
    const client = createApiClient({ baseUrl: 'https://api.example', fetch: stubFetch(502, undefined, { 'x-request-id': 'r3' }) })
    await expect(client.getTrails()).rejects.toMatchObject({ status: 502, code: 'http_error', requestId: 'r3' })
  })

  it('rejects a response that does not match the contract', async () => {
    const client = createApiClient({ baseUrl: 'https://api.example', fetch: stubFetch(200, { trails: [{ id: 'x' }] }) })
    await expect(client.getTrails()).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('saves and unsaves with PUT and DELETE and returns the new status', async () => {
    const fetch = stubFetch(200, { status: 'saved' })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    expect(await client.saveTrail(trailDetail.id)).toEqual({ status: 'saved' })
    expect(fetch.mock.calls[0][0]).toBe(`https://api.example/v1/me/saved-trails/${trailDetail.id}`)
    expect(fetch.mock.calls[0][1]?.method).toBe('PUT')

    const del = stubFetch(200, { status: null })
    await createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch: del }).unsaveTrail(trailDetail.id)
    expect(del.mock.calls[0][1]?.method).toBe('DELETE')
  })

  it('reports a hidden trail on save as a 404 ApiError', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.example',
      fetch: stubFetch(404, { error: 'not_found', message: 'This trail isn’t available anymore.', requestId: 'r9' }),
    })
    await expect(client.saveTrail(trailDetail.id)).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })

  it('creates and updates trails with a JSON body', async () => {
    const fetch = stubFetch(201, { id: trailDetail.id })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    const body = { title: 'Walk', status: 'draft' as const, stops: [] }
    expect(await client.createTrail(body)).toEqual({ id: trailDetail.id })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.example/v1/trails')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual(body)

    const put = stubFetch(200, { id: trailDetail.id })
    await createApiClient({ baseUrl: 'https://api.example', fetch: put }).updateTrail(trailDetail.id, body)
    expect(put.mock.calls[0][0]).toBe(`https://api.example/v1/trails/${trailDetail.id}`)
    expect(put.mock.calls[0][1]?.method).toBe('PUT')
  })

  it('passes save_trail messages through as ApiError', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.example',
      fetch: stubFetch(422, { error: 'unprocessable_entity', message: 'Add at least 2 stops before publishing', requestId: 'r5' }),
    })
    await expect(client.createTrail({ title: 'x', status: 'published', stops: [] })).rejects.toMatchObject({
      status: 422,
      message: 'Add at least 2 stops before publishing',
    })
  })

  it('reads progress and runs trail actions and crumb ticks with the right routes', async () => {
    const calls: [string, string | undefined][] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      calls.push([String(url), init?.method])
      const path = String(url)
      const body = path.endsWith('/crumbs') ? { crumbIds: [] } : path.includes('/me/crumbs/') ? { done: init?.method === 'PUT' } : { status: 'in_progress' }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    const id = trailDetail.id
    expect(await client.getMyProgress(id)).toEqual({ status: 'in_progress' })
    expect(await client.trailAction(id, 'start')).toEqual({ status: 'in_progress' })
    expect(await client.getTickedCrumbs(id)).toEqual([])
    expect(await client.setCrumb(id, true)).toEqual({ done: true })
    expect(await client.setCrumb(id, false)).toEqual({ done: false })
    expect(calls).toEqual([
      [`https://api.example/v1/me/trails/${id}/progress`, 'GET'],
      [`https://api.example/v1/me/trails/${id}/start`, 'POST'],
      [`https://api.example/v1/me/trails/${id}/crumbs`, 'GET'],
      [`https://api.example/v1/me/crumbs/${id}`, 'PUT'],
      [`https://api.example/v1/me/crumbs/${id}`, 'DELETE'],
    ])
  })

  it('reads, saves and deletes your rating with the right routes and body', async () => {
    const rating = { id: trailDetail.id, price: 4, time: 3, enjoyment: 5, memorability: 5, review: 'Great', createdAt: '2026-11-26T12:00:00Z' }
    const calls: [string, string | undefined, string | undefined][] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      calls.push([String(url), init?.method, init?.body as string | undefined])
      const body = { rating: init?.method === 'DELETE' ? null : rating }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    const id = trailDetail.id
    const input = { price: 4, time: 3, enjoyment: 5, memorability: 5, review: 'Great' }
    expect(await client.getMyRating(id)).toEqual(rating)
    expect(await client.rateTrail(id, input)).toEqual(rating)
    await client.deleteMyRating(id)
    const url = `https://api.example/v1/me/trails/${id}/rating`
    expect(calls).toEqual([
      [url, 'GET', undefined],
      [url, 'PUT', JSON.stringify(input)],
      [url, 'DELETE', undefined],
    ])
  })
})

describe('RatingBody', () => {
  const ok = { price: 1, time: 2, enjoyment: 3, memorability: 5 }
  it('accepts whole scores from 1 to 5 and an optional review', () => {
    expect(RatingBody.safeParse(ok).success).toBe(true)
    expect(RatingBody.safeParse({ ...ok, review: null }).success).toBe(true)
    expect(RatingBody.safeParse({ ...ok, review: 'x'.repeat(2000) }).success).toBe(true)
  })
  it.each([
    ['a zero', { ...ok, price: 0 }],
    ['a six', { ...ok, time: 6 }],
    ['a half star', { ...ok, enjoyment: 3.5 }],
    ['a missing score', { price: 1, time: 2, enjoyment: 3 }],
    ['a long review', { ...ok, review: 'x'.repeat(2001) }],
    ['an unknown key', { ...ok, user_id: 'someone' }],
  ])('rejects %s', (_label, body) => {
    expect(RatingBody.safeParse(body).success).toBe(false)
  })
})
