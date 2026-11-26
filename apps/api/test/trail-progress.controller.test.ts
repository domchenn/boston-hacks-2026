/**
 * HTTP tests for the caller's trail progress with the data layer stubbed: sign-in
 * required, uuid and action validation, routing to the service with the verified
 * user, and the 403 for ticking a crumb on a trail that isn't started.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ProgressService } from '../src/progress/progress.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL = '5eed0000-0000-4000-8000-000000000001'
const CRUMB = '5eed0000-0000-4000-8000-0000000000c1'
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: ProgressService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(ProgressService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, signedIn = true) =>
  app.inject({ method, url, headers: signedIn ? { authorization: `Bearer ${token}` } : {} })

describe('trail progress', () => {
  it.each([
    ['GET', `/v1/me/trails/${TRAIL}/progress`],
    ['POST', `/v1/me/trails/${TRAIL}/start`],
    ['GET', `/v1/me/trails/${TRAIL}/crumbs`],
    ['PUT', `/v1/me/crumbs/${CRUMB}`],
    ['DELETE', `/v1/me/crumbs/${CRUMB}`],
  ] as const)('%s %s requires sign-in', async (method, url) => {
    expect((await call(method, url, false)).statusCode).toBe(401)
  })

  it('reads the status for the verified user', async () => {
    const status = vi.spyOn(service, 'status').mockResolvedValue({ status: 'in_progress' })
    const res = await call('GET', `/v1/me/trails/${TRAIL}/progress`)
    expect(res.json()).toEqual({ status: 'in_progress' })
    expect(status).toHaveBeenCalledWith(TRAIL, expect.objectContaining({ id: USER_ID }))
  })

  it.each(['start', 'finish', 'abort'] as const)('POST %s runs that action', async (action) => {
    const act = vi.spyOn(service, 'act').mockResolvedValue({ status: 'completed' })
    const res = await call('POST', `/v1/me/trails/${TRAIL}/${action}`)
    expect(res.statusCode).toBe(200)
    expect(act).toHaveBeenCalledWith(TRAIL, action, expect.objectContaining({ id: USER_ID }))
  })

  it('rejects an unknown action or a bad id with 400', async () => {
    expect((await call('POST', `/v1/me/trails/${TRAIL}/delete`)).statusCode).toBe(400)
    expect((await call('POST', '/v1/me/trails/abc/start')).statusCode).toBe(400)
  })

  it('lists ticked crumbs', async () => {
    vi.spyOn(service, 'tickedCrumbs').mockResolvedValue([CRUMB])
    expect((await call('GET', `/v1/me/trails/${TRAIL}/crumbs`)).json()).toEqual({ crumbIds: [CRUMB] })
  })

  it('ticks and unticks crumbs', async () => {
    const set = vi.spyOn(service, 'setCrumb').mockImplementation(async (_id, done) => ({ done }))
    expect((await call('PUT', `/v1/me/crumbs/${CRUMB}`)).json()).toEqual({ done: true })
    expect((await call('DELETE', `/v1/me/crumbs/${CRUMB}`)).json()).toEqual({ done: false })
    expect(set).toHaveBeenNthCalledWith(1, CRUMB, true, expect.objectContaining({ id: USER_ID }))
  })

  it('a crumb on a trail that is not started is 403 with a readable message', async () => {
    vi.spyOn(service, 'setCrumb').mockRejectedValue(new ForbiddenException('Start this trail before checking off its crumbs.'))
    const res = await call('PUT', `/v1/me/crumbs/${CRUMB}`)
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('Start this trail before checking off its crumbs.')
  })
})
