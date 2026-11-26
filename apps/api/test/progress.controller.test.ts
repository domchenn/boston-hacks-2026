/**
 * HTTP tests for save / unsave with the data layer stubbed: sign-in required, uuid
 * validation, PUT/DELETE routing with the verified user, and the 404 for a hidden
 * trail. Transition rules and RLS against a real database are in
 * test/integration/progress.rls.test.ts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TrailProgress } from '@breadcrumb/contracts'
import { ProgressService } from '../src/progress/progress.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL = '5eed0000-0000-4000-8000-000000000001'
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

const call = (method: 'PUT' | 'DELETE', id = TRAIL, signedIn = true) =>
  app.inject({ method, url: `/v1/me/saved-trails/${id}`, headers: signedIn ? { authorization: `Bearer ${token}` } : {} })

describe('PUT / DELETE /v1/me/saved-trails/:trailId', () => {
  it.each(['PUT', 'DELETE'] as const)('%s requires sign-in', async (method) => {
    expect((await call(method, TRAIL, false)).statusCode).toBe(401)
  })

  it.each(['PUT', 'DELETE'] as const)('%s rejects a non-uuid id', async (method) => {
    const save = vi.spyOn(service, 'save')
    const unsave = vi.spyOn(service, 'unsave')
    expect((await call(method, 'abc')).statusCode).toBe(400)
    expect(save).not.toHaveBeenCalled()
    expect(unsave).not.toHaveBeenCalled()
  })

  it('PUT saves for the verified user and returns the new status', async () => {
    const save = vi.spyOn(service, 'save').mockResolvedValue({ status: 'saved' })
    const res = await call('PUT')
    expect(res.statusCode).toBe(200)
    expect(TrailProgress.parse(res.json())).toEqual({ status: 'saved' })
    expect(save).toHaveBeenCalledWith(TRAIL, expect.objectContaining({ id: USER_ID }))
  })

  it('DELETE unsaves and can return a null status', async () => {
    vi.spyOn(service, 'unsave').mockResolvedValue({ status: null })
    const res = await call('DELETE')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: null })
  })

  it('a hidden trail is a 404 with a readable message', async () => {
    vi.spyOn(service, 'save').mockRejectedValue(new NotFoundException('This trail isn’t available anymore.'))
    const res = await call('PUT')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'not_found', message: 'This trail isn’t available anymore.' })
  })
})
