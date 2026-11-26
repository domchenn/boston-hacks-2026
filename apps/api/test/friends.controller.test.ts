/**
 * HTTP tests for follows and friends with the data layer stubbed: which routes need
 * sign-in, uuid and body validation, routing to the service with the verified user
 * (or none), and the 422 / 403 / 404 messages.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { FriendsService } from '../src/friends/friends.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const OTHER = '5eed0000-0000-4000-8000-0000000000f1'
const PERSON = { id: OTHER, username: 'sam', display_name: 'Sam', avatar_url: null }
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: FriendsService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(FriendsService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

type Method = 'GET' | 'PUT' | 'DELETE'
const call = (method: Method, url: string, { signedIn = true, payload }: { signedIn?: boolean; payload?: object } = {}) =>
  app.inject({ method, url, headers: signedIn ? { authorization: `Bearer ${token}` } : {}, ...(payload ? { payload } : {}) })
const me = expect.objectContaining({ id: USER_ID })

describe('sign-in', () => {
  it.each([
    ['GET', '/v1/me/following-ids'],
    ['PUT', `/v1/me/following/${OTHER}`],
    ['DELETE', `/v1/me/following/${OTHER}`],
    ['GET', `/v1/me/relationships/${OTHER}`],
    ['GET', '/v1/me/friends'],
    ['GET', '/v1/me/close-friends'],
    ['PUT', `/v1/me/close-friends/${OTHER}`],
    ['DELETE', `/v1/me/close-friends/${OTHER}`],
    ['PUT', '/v1/me/privacy'],
  ] as const)('%s %s requires sign-in', async (method, url) => {
    expect((await call(method, url, { signedIn: false, payload: url.endsWith('privacy') ? { isPrivate: true } : undefined })).statusCode).toBe(401)
  })

  it('follow counts and lists work signed out', async () => {
    const counts = vi.spyOn(service, 'followCounts').mockResolvedValue({ followers: 2, following: 1 })
    const list = vi.spyOn(service, 'followList').mockResolvedValue([PERSON])
    expect((await call('GET', `/v1/profiles/${OTHER}/follow-counts`, { signedIn: false })).json()).toEqual({ followers: 2, following: 1 })
    expect((await call('GET', `/v1/profiles/${OTHER}/followers`, { signedIn: false })).json()).toEqual({ people: [PERSON] })
    expect((await call('GET', `/v1/profiles/${OTHER}/following`, { signedIn: false })).json()).toEqual({ people: [PERSON] })
    expect(counts).toHaveBeenCalledWith(OTHER, null)
    expect(list).toHaveBeenNthCalledWith(1, OTHER, 'followers', null)
    expect(list).toHaveBeenNthCalledWith(2, OTHER, 'following', null)
  })
})

describe('the caller’s connections', () => {
  it('routes follow, unfollow, close friends and privacy for the verified user', async () => {
    const follow = vi.spyOn(service, 'setFollowing').mockImplementation(async (_id, on) => on)
    const close = vi.spyOn(service, 'setCloseFriend').mockImplementation(async (_id, on) => on)
    const priv = vi.spyOn(service, 'setPrivate').mockImplementation(async (on) => on)
    expect((await call('PUT', `/v1/me/following/${OTHER}`)).json()).toEqual({ following: true })
    expect((await call('DELETE', `/v1/me/following/${OTHER}`)).json()).toEqual({ following: false })
    expect((await call('PUT', `/v1/me/close-friends/${OTHER}`)).json()).toEqual({ closeFriend: true })
    expect((await call('DELETE', `/v1/me/close-friends/${OTHER}`)).json()).toEqual({ closeFriend: false })
    expect((await call('PUT', '/v1/me/privacy', { payload: { isPrivate: true } })).json()).toEqual({ isPrivate: true })
    expect(follow).toHaveBeenNthCalledWith(1, OTHER, true, me)
    expect(close).toHaveBeenNthCalledWith(2, OTHER, false, me)
    expect(priv).toHaveBeenCalledWith(true, me)
  })

  it('reads ids, relationship and friends', async () => {
    vi.spyOn(service, 'followingIds').mockResolvedValue([OTHER])
    vi.spyOn(service, 'closeFriendIds').mockResolvedValue([])
    vi.spyOn(service, 'relationship').mockResolvedValue({ following: true, followsYou: false })
    vi.spyOn(service, 'friends').mockResolvedValue([PERSON])
    expect((await call('GET', '/v1/me/following-ids')).json()).toEqual({ ids: [OTHER] })
    expect((await call('GET', '/v1/me/close-friends')).json()).toEqual({ ids: [] })
    expect((await call('GET', `/v1/me/relationships/${OTHER}`)).json()).toEqual({ following: true, followsYou: false })
    expect((await call('GET', '/v1/me/friends')).json()).toEqual({ people: [PERSON] })
  })

  it.each([
    ['GET', '/v1/profiles/abc/followers'],
    ['PUT', '/v1/me/following/abc'],
    ['PUT', '/v1/me/close-friends/abc'],
    ['GET', '/v1/me/relationships/abc'],
  ] as const)('%s %s (bad id) is 400', async (method, url) => {
    expect((await call(method, url)).statusCode).toBe(400)
  })

  it.each([{}, { isPrivate: 'yes' }, { isPrivate: true, userId: OTHER }])('privacy body %j is 400', async (payload) => {
    expect((await call('PUT', '/v1/me/privacy', { payload })).statusCode).toBe(400)
  })

  it.each([
    ['PUT', `/v1/me/following/${OTHER}`, 'setFollowing', new UnprocessableEntityException('You can’t follow yourself.'), 422],
    ['PUT', `/v1/me/following/${OTHER}`, 'setFollowing', new NotFoundException('This person isn’t on Breadcrumb anymore.'), 404],
    ['PUT', `/v1/me/close-friends/${OTHER}`, 'setCloseFriend', new ForbiddenException('Only friends (people who follow you back) can be close friends.'), 403],
  ] as const)('%s %s passes "%s" refusals through', async (method, url, fn, error, status) => {
    vi.spyOn(service, fn).mockRejectedValue(error)
    const res = await call(method, url)
    expect(res.statusCode).toBe(status)
    expect(res.json().message).toBe(error.message)
  })
})
