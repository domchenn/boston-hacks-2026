/**
 * Client tests with a stub fetch: URLs and query encoding, the bearer token,
 * response validation, 404 → null for one trail, and typed ApiError on failures.
 */
import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from '../src/index.js'
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
})
