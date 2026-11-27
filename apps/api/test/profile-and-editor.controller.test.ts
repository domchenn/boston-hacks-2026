/**
 * HTTP tests for profile fields and the trail editor's calls with the data layer
 * stubbed: which routes need sign-in, body and id validation, routing with the
 * verified user (or none), and the 409 / 404 messages.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { MyProfileService } from '../src/profiles/my-profile.service.js'
import { TrailWritesService } from '../src/trails/trail-writes.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL = '5eed0000-0000-4000-8000-000000000001'
const BODY = { username: 'sam_k', displayName: 'Sam' }
let supabase: FakeSupabase
let app: NestFastifyApplication
let profile: MyProfileService
let writes: TrailWritesService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  profile = app.get(MyProfileService)
  writes = app.get(TrailWritesService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

type Method = 'GET' | 'PUT' | 'POST' | 'DELETE'
const call = (method: Method, url: string, { signedIn = true, payload }: { signedIn?: boolean; payload?: object } = {}) =>
  app.inject({ method, url, headers: signedIn ? { authorization: `Bearer ${token}` } : {}, ...(payload ? { payload } : {}) })
const me = expect.objectContaining({ id: USER_ID })

describe('sign-in', () => {
  it.each([
    ['GET', '/v1/me/profile'],
    ['PUT', '/v1/me/profile'],
    ['POST', `/v1/trails/${TRAIL}/unpublish`],
    ['DELETE', `/v1/trails/${TRAIL}`],
  ] as const)('%s %s requires sign-in', async (method, url) => {
    expect((await call(method, url, { signedIn: false, payload: method === 'PUT' ? BODY : undefined })).statusCode).toBe(401)
  })

  it('the stop library works signed out', async () => {
    const lib = vi.spyOn(writes, 'stopLibrary').mockResolvedValue([{ stopId: TRAIL, experienceId: null, neighborhood: null }])
    expect((await call('GET', `/v1/trails/${TRAIL}/stop-library`, { signedIn: false })).json()).toEqual({
      stops: [{ stopId: TRAIL, experienceId: null, neighborhood: null }],
    })
    expect(lib).toHaveBeenCalledWith(TRAIL, null)
  })
})

describe('profile fields', () => {
  it('reads and saves for the verified user', async () => {
    const fields = { username: 'sam_k', displayName: null }
    vi.spyOn(profile, 'get').mockResolvedValue(fields)
    const update = vi.spyOn(profile, 'update').mockResolvedValue(fields)
    expect((await call('GET', '/v1/me/profile')).json()).toEqual(fields)
    expect((await call('PUT', '/v1/me/profile', { payload: BODY })).json()).toEqual(fields)
    expect(update).toHaveBeenCalledWith(BODY, me)
  })

  it.each([
    ['a username with capitals', { ...BODY, username: 'Sam' }],
    ['a two-letter username', { ...BODY, username: 'ab' }],
    ['a long display name', { ...BODY, displayName: 'x'.repeat(81) }],
    ['a university (no longer a profile field)', { ...BODY, university: 'BU' }],
    ['a missing field', { username: 'sam_k' }],
    ['an extra field', { ...BODY, is_admin: true }],
  ])('rejects %s with 400 before touching the database', async (_label, payload) => {
    const update = vi.spyOn(profile, 'update')
    expect((await call('PUT', '/v1/me/profile', { payload })).statusCode).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('a taken username is 409 with a readable message', async () => {
    vi.spyOn(profile, 'update').mockRejectedValue(new ConflictException('That username is taken. Try another one.'))
    const res = await call('PUT', '/v1/me/profile', { payload: BODY })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toBe('That username is taken. Try another one.')
  })
})

describe('unpublish and delete', () => {
  it('route to the service for the verified user', async () => {
    const unpublish = vi.spyOn(writes, 'unpublish').mockResolvedValue({ id: TRAIL, status: 'draft' })
    const remove = vi.spyOn(writes, 'remove').mockResolvedValue({ id: TRAIL, deleted: true })
    expect((await call('POST', `/v1/trails/${TRAIL}/unpublish`)).json()).toEqual({ id: TRAIL, status: 'draft' })
    expect((await call('DELETE', `/v1/trails/${TRAIL}`)).json()).toEqual({ id: TRAIL, deleted: true })
    expect(unpublish).toHaveBeenCalledWith(TRAIL, me)
    expect(remove).toHaveBeenCalledWith(TRAIL, me)
  })

  it('someone else’s trail is 404; a bad id is 400', async () => {
    vi.spyOn(writes, 'remove').mockRejectedValue(new NotFoundException('This trail isn’t yours, or it no longer exists.'))
    const res = await call('DELETE', `/v1/trails/${TRAIL}`)
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('This trail isn’t yours, or it no longer exists.')
    expect((await call('POST', '/v1/trails/abc/unpublish')).statusCode).toBe(400)
  })
})
