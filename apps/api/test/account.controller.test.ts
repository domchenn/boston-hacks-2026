/**
 * HTTP tests for DELETE /v1/me with the data layer stubbed: sign-in required, the body
 * must be exactly { confirm: true }, the verified user is the one deleted, and a
 * Storage failure comes back as 503 with a readable message.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ServiceUnavailableException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AccountService } from '../src/account/account.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

let supabase: FakeSupabase
let app: NestFastifyApplication
let service: AccountService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(AccountService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const del = (payload?: object, signedIn = true) =>
  app.inject({ method: 'DELETE', url: '/v1/me', headers: signedIn ? { authorization: `Bearer ${token}` } : {}, ...(payload ? { payload } : {}) })

describe('DELETE /v1/me', () => {
  it('requires sign-in', async () => {
    expect((await del({ confirm: true }, false)).statusCode).toBe(401)
  })

  it('deletes the verified user’s account', async () => {
    const remove = vi.spyOn(service, 'deleteAccount').mockResolvedValue({ deleted: true })
    const res = await del({ confirm: true })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ deleted: true })
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }))
  })

  it.each([undefined, {}, { confirm: false }, { confirm: 'true' }, { confirm: true, userId: USER_ID }])('body %j is 400 and deletes nothing', async (payload) => {
    const remove = vi.spyOn(service, 'deleteAccount')
    expect((await del(payload)).statusCode).toBe(400)
    expect(remove).not.toHaveBeenCalled()
  })

  it('a Storage failure is 503 with a readable message', async () => {
    vi.spyOn(service, 'deleteAccount').mockRejectedValue(
      new ServiceUnavailableException('We couldn’t remove all your photos, so your account is still here. Please try again.'),
    )
    const res = await del({ confirm: true })
    expect(res.statusCode).toBe(503)
    expect(res.json().message).toContain('your account is still here')
  })
})
