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

  it('calls the Explore, badges and communities routes', async () => {
    const calls: [string, string | undefined, string | undefined][] = []
    const bodies: Record<string, unknown> = {
      '/v1/trending': { trails: [{ trailId: trailDetail.id, score: 5, people: 2 }] },
      '/v1/neighborhoods': { neighborhoods: ['Allston'] },
      '/v1/communities': { communities: [{ id: trailDetail.id, name: 'Boston University', slug: 'bu' }] },
      '/v1/me/community': { communityId: null },
      '/v1/me/finished-trails': { trails: [{ completedAt: '2026-11-20T12:00:00Z', line: 'rl', neighborhood: null }] },
    }
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      calls.push([String(url), init?.method, init?.body as string | undefined])
      const body = bodies[new URL(String(url)).pathname]
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    expect(await client.getTrending({ days: 14, limit: 30 })).toEqual([{ trailId: trailDetail.id, score: 5, people: 2 }])
    expect(await client.getTrending()).toHaveLength(1)
    expect(await client.getNeighborhoods()).toEqual(['Allston'])
    expect(await client.getCommunities()).toHaveLength(1)
    expect(await client.setMyCommunity(null)).toEqual({ communityId: null })
    expect(await client.getFinishedTrails()).toEqual([{ completedAt: '2026-11-20T12:00:00Z', line: 'rl', neighborhood: null }])
    expect(calls).toEqual([
      ['https://api.example/v1/trending?days=14&limit=30', 'GET', undefined],
      ['https://api.example/v1/trending', 'GET', undefined],
      ['https://api.example/v1/neighborhoods', 'GET', undefined],
      ['https://api.example/v1/communities', 'GET', undefined],
      ['https://api.example/v1/me/community', 'PUT', '{"communityId":null}'],
      ['https://api.example/v1/me/finished-trails', 'GET', undefined],
    ])
  })

  it('calls the follow and friends routes', async () => {
    const other = trailDetail.id
    const person = { id: other, username: 'sam', display_name: 'Sam', avatar_url: null }
    const calls: [string, string | undefined, string | undefined][] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      const path = new URL(String(url)).pathname
      calls.push([path, init?.method, init?.body as string | undefined])
      const body = path.endsWith('/follow-counts')
        ? { followers: 1, following: 2 }
        : /following-ids$|close-friends$/.test(path)
          ? { ids: [other] }
          : /followers$|following$|friends$/.test(path)
            ? { people: [person] }
            : path.includes('/relationships/')
              ? { following: true, followsYou: true }
              : path.includes('/me/following/')
                ? { following: init?.method === 'PUT' }
                : path.includes('/me/close-friends/')
                  ? { closeFriend: init?.method === 'PUT' }
                  : { isPrivate: true }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    expect(await client.getFollowCounts(other)).toEqual({ followers: 1, following: 2 })
    expect(await client.getFollowList(other, 'followers')).toEqual([person])
    expect(await client.getFollowList(other, 'following')).toEqual([person])
    expect(await client.getFollowingIds()).toEqual([other])
    expect(await client.setFollowing(other, true)).toEqual({ following: true })
    expect(await client.setFollowing(other, false)).toEqual({ following: false })
    expect(await client.getRelationship(other)).toEqual({ following: true, followsYou: true })
    expect(await client.getFriends()).toEqual([person])
    expect(await client.getCloseFriendIds()).toEqual([other])
    expect(await client.setCloseFriend(other, true)).toEqual({ closeFriend: true })
    expect(await client.setPrivateAccount(true)).toEqual({ isPrivate: true })
    expect(calls).toEqual([
      [`/v1/profiles/${other}/follow-counts`, 'GET', undefined],
      [`/v1/profiles/${other}/followers`, 'GET', undefined],
      [`/v1/profiles/${other}/following`, 'GET', undefined],
      ['/v1/me/following-ids', 'GET', undefined],
      [`/v1/me/following/${other}`, 'PUT', undefined],
      [`/v1/me/following/${other}`, 'DELETE', undefined],
      [`/v1/me/relationships/${other}`, 'GET', undefined],
      ['/v1/me/friends', 'GET', undefined],
      ['/v1/me/close-friends', 'GET', undefined],
      [`/v1/me/close-friends/${other}`, 'PUT', undefined],
      ['/v1/me/privacy', 'PUT', '{"isPrivate":true}'],
    ])
  })

  it('calls the activity, also-saved, trail card and people routes', async () => {
    const id = trailDetail.id
    const person = { id, username: 'sam', display_name: 'Sam', avatar_url: null }
    const card = {
      id,
      title: 'Walk',
      category: null,
      customCategory: null,
      neighborhood: null,
      estimatedCost: null,
      estimatedMinutes: null,
      scheduledAt: null,
      stopCount: 0,
      firstStopName: null,
      lastStopName: null,
      rating: { average: null, count: 0 },
      creator: null,
    }
    const urls: string[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
      urls.push(String(url))
      const path = new URL(String(url)).pathname
      const body =
        path === '/v1/trail-cards'
          ? { trails: [card] }
          : path === '/v1/me/friends-activity'
            ? { items: [{ person, kind: 'made', trailId: id, at: '2026-11-20T12:00:00Z' }], trails: [card] }
            : path === '/v1/me/friends-also-saved'
              ? { saves: [{ trailId: id, friend: person }] }
              : { people: [person] }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    expect(await client.getTrailCards([id, id])).toEqual([card])
    expect((await client.getFriendsActivity(12)).items).toHaveLength(1)
    expect(await client.getFriendsActivity()).toBeTruthy()
    expect(await client.getFriendsAlsoSaved()).toEqual([{ trailId: id, friend: person }])
    expect(await client.searchPeople('@sam b', 5)).toEqual([person])
    expect(await client.getSuggestedPeople()).toEqual([person])
    expect(urls).toEqual([
      `https://api.example/v1/trail-cards?ids=${id},${id}`,
      'https://api.example/v1/me/friends-activity?limit=12',
      'https://api.example/v1/me/friends-activity',
      'https://api.example/v1/me/friends-also-saved',
      'https://api.example/v1/people?q=%40sam+b&limit=5',
      'https://api.example/v1/me/suggested-people',
    ])
  })

  it('calls the profile and editor routes', async () => {
    const id = trailDetail.id
    const fields = { username: 'sam_k', displayName: 'Sam', university: null }
    const calls: [string, string | undefined, string | undefined][] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      const path = new URL(String(url)).pathname
      calls.push([path, init?.method, init?.body as string | undefined])
      const body = path.endsWith('/stop-library')
        ? { stops: [{ stopId: id, experienceId: null, neighborhood: 'Allston' }] }
        : path.endsWith('/unpublish')
          ? { id, status: 'draft' }
          : path === '/v1/me/profile'
            ? fields
            : { id, deleted: true }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createApiClient({ baseUrl: 'https://api.example', getAccessToken: () => 'tok', fetch })
    expect(await client.getStopLibrary(id)).toEqual([{ stopId: id, experienceId: null, neighborhood: 'Allston' }])
    expect(await client.unpublishTrail(id)).toEqual({ id, status: 'draft' })
    expect(await client.deleteTrail(id)).toEqual({ id, deleted: true })
    expect(await client.getMyProfile()).toEqual(fields)
    expect(await client.updateMyProfile({ username: 'sam_k', displayName: 'Sam', university: '' })).toEqual(fields)
    expect(calls).toEqual([
      [`/v1/trails/${id}/stop-library`, 'GET', undefined],
      [`/v1/trails/${id}/unpublish`, 'POST', undefined],
      [`/v1/trails/${id}`, 'DELETE', undefined],
      ['/v1/me/profile', 'GET', undefined],
      ['/v1/me/profile', 'PUT', '{"username":"sam_k","displayName":"Sam","university":""}'],
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
