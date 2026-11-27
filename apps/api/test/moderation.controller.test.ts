/**
 * HTTP tests for reports and moderation with the data layer stubbed: everything needs
 * sign-in, report and resolve bodies are validated before the service sees them,
 * routing uses the verified user, and the 403 / 404 / 409 messages come through.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ConflictException, ForbiddenException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ModerationService } from '../src/moderation/moderation.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TARGET = '5eed0000-0000-4000-8000-000000000001'
const REPORT = '5eed0000-0000-4000-8000-0000000000f1'
const BODY = { targetType: 'trail', targetId: TARGET, reason: 'unsafe', note: 'Closed at night' }
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: ModerationService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(ModerationService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const call = (method: 'GET' | 'POST', url: string, { signedIn = true, payload }: { signedIn?: boolean; payload?: object } = {}) =>
  app.inject({ method, url, headers: signedIn ? { authorization: `Bearer ${token}` } : {}, ...(payload ? { payload } : {}) })
const me = expect.objectContaining({ id: USER_ID })

describe('sign-in', () => {
  it.each([
    ['POST', '/v1/reports'],
    ['GET', '/v1/me/admin'],
    ['GET', '/v1/admin/reports'],
    ['POST', `/v1/admin/reports/${REPORT}/resolve`],
  ] as const)('%s %s requires sign-in', async (method, url) => {
    expect((await call(method, url, { signedIn: false, payload: method === 'POST' ? {} : undefined })).statusCode).toBe(401)
  })
})

describe('reporting', () => {
  it('sends the report for the verified user (201)', async () => {
    const report = vi.spyOn(service, 'report').mockResolvedValue({ reported: true })
    const res = await call('POST', '/v1/reports', { payload: BODY })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ reported: true })
    expect(report).toHaveBeenCalledWith(BODY, me)
  })

  it.each([
    ['an unknown target type', { ...BODY, targetType: 'profile' }],
    ['an unknown reason', { ...BODY, reason: 'boring' }],
    ['a bad id', { ...BODY, targetId: 'abc' }],
    ['a long note', { ...BODY, note: 'x'.repeat(1001) }],
    ['someone else as reporter', { ...BODY, reporterId: USER_ID }],
  ])('rejects %s with 400', async (_label, payload) => {
    const report = vi.spyOn(service, 'report')
    expect((await call('POST', '/v1/reports', { payload })).statusCode).toBe(400)
    expect(report).not.toHaveBeenCalled()
  })
})

describe('moderation', () => {
  it('answers whether you are a moderator', async () => {
    vi.spyOn(service, 'isAdmin').mockResolvedValue(true)
    expect((await call('GET', '/v1/me/admin')).json()).toEqual({ isAdmin: true })
  })

  it('lists reports and resolves one for the verified user', async () => {
    vi.spyOn(service, 'openReports').mockResolvedValue([])
    const resolve = vi.spyOn(service, 'resolve').mockResolvedValue({ id: REPORT, status: 'hidden' })
    expect((await call('GET', '/v1/admin/reports')).json()).toEqual({ reports: [] })
    expect((await call('POST', `/v1/admin/reports/${REPORT}/resolve`, { payload: { action: 'hide' } })).json()).toEqual({ id: REPORT, status: 'hidden' })
    expect(resolve).toHaveBeenCalledWith(REPORT, 'hide', me)
  })

  it.each([{}, { action: 'delete' }, { action: 'hide', note: 'x' }])('rejects resolve body %j with 400', async (payload) => {
    expect((await call('POST', `/v1/admin/reports/${REPORT}/resolve`, { payload })).statusCode).toBe(400)
  })

  it.each([
    [new ForbiddenException('Only the Breadcrumb team can do this.'), 403],
    [new ConflictException('This report was already handled.'), 409],
  ])('passes "%s" through', async (error, status) => {
    vi.spyOn(service, 'resolve').mockRejectedValue(error)
    const res = await call('POST', `/v1/admin/reports/${REPORT}/resolve`, { payload: { action: 'dismiss' } })
    expect(res.statusCode).toBe(status)
    expect(res.json().message).toBe(error.message)
  })
})
