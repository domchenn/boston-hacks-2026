/**
 * HTTP tests for trail photos with the data layer stubbed: listing works signed out,
 * uploading and deleting need sign-in; the image arrives as a raw body (image/*),
 * non-image bodies are 415, bodies over 5 MB are 413, an empty body is 400, and the
 * caption / stop query is validated before the service sees anything.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { PhotosService } from '../src/photos/photos.service.js'
import { startFakeSupabase, USER_ID, type FakeSupabase } from './support/fake-supabase.js'
import { startTestApp } from './support/test-app.js'

const TRAIL = '5eed0000-0000-4000-8000-000000000001'
const STOP = '5eed0000-0000-4000-8000-0000000000e1'
const PHOTO = {
  id: '5eed0000-0000-4000-8000-0000000000d1',
  url: 'https://example.supabase.co/storage/v1/object/public/trail-photos/u/trails/t/1.jpg',
  caption: null,
  createdAt: '2026-11-26T12:00:00Z',
  stopId: null,
  uploader: null,
}
const IMAGE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
let supabase: FakeSupabase
let app: NestFastifyApplication
let service: PhotosService
let token: string

beforeAll(async () => {
  supabase = await startFakeSupabase()
  app = await startTestApp({ SUPABASE_URL: supabase.url })
  service = app.get(PhotosService)
  token = await supabase.token()
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await app.close()
  await supabase.close()
})

const upload = (url: string, body: Buffer | string, contentType = 'image/jpeg', signedIn = true) =>
  app.inject({
    method: 'POST',
    url,
    payload: body,
    headers: { 'content-type': contentType, ...(signedIn ? { authorization: `Bearer ${token}` } : {}) },
  })
const me = expect.objectContaining({ id: USER_ID })

describe('reading', () => {
  it('lists a trail’s photos signed out', async () => {
    const list = vi.spyOn(service, 'list').mockResolvedValue([PHOTO])
    const res = await app.inject({ method: 'GET', url: `/v1/trails/${TRAIL}/photos` })
    expect(res.json()).toEqual({ photos: [PHOTO] })
    expect(list).toHaveBeenCalledWith(TRAIL, null)
  })
})

describe('uploading', () => {
  it('requires sign-in', async () => {
    expect((await upload(`/v1/trails/${TRAIL}/photos`, IMAGE, 'image/jpeg', false)).statusCode).toBe(401)
  })

  it('passes the image bytes, caption and stop to the service for the verified user', async () => {
    const add = vi.spyOn(service, 'add').mockResolvedValue(PHOTO)
    const res = await upload(`/v1/trails/${TRAIL}/photos?caption=At%20the%20park&stopId=${STOP}`, IMAGE, 'image/png')
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ photo: PHOTO })
    expect(add).toHaveBeenCalledWith(TRAIL, IMAGE, { caption: 'At the park', stopId: STOP }, me)
  })

  it.each([
    ['text/plain', 'not an image'],
    ['application/json', '{"photo":"x"}'],
  ])('a %s body is 415 and never reaches the service', async (type, body) => {
    const add = vi.spyOn(service, 'add')
    expect((await upload(`/v1/trails/${TRAIL}/photos`, body, type)).statusCode).toBe(415)
    expect(add).not.toHaveBeenCalled()
  })

  it('more than 5 MB is 413; an empty body is 400', async () => {
    const add = vi.spyOn(service, 'add')
    expect((await upload(`/v1/trails/${TRAIL}/photos`, Buffer.alloc(5 * 1024 * 1024 + 1))).statusCode).toBe(413)
    expect((await upload(`/v1/trails/${TRAIL}/photos`, Buffer.alloc(0))).statusCode).toBe(400)
    expect(add).not.toHaveBeenCalled()
  })

  it.each([`caption=${'x'.repeat(301)}`, 'stopId=abc', 'url=https://evil.example/x.jpg'])('?%s is 400', async (query) => {
    expect((await upload(`/v1/trails/${TRAIL}/photos?${query}`, IMAGE)).statusCode).toBe(400)
  })

  it('a trail you haven’t saved or started is 403 with a readable message', async () => {
    vi.spyOn(service, 'add').mockRejectedValue(new ForbiddenException('Start or save this trail before adding photos.'))
    const res = await upload(`/v1/trails/${TRAIL}/photos`, IMAGE)
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('Start or save this trail before adding photos.')
  })
})

describe('deleting', () => {
  it('requires sign-in and routes your own photo to the service', async () => {
    expect((await app.inject({ method: 'DELETE', url: `/v1/photos/${PHOTO.id}` })).statusCode).toBe(401)
    const remove = vi.spyOn(service, 'remove').mockResolvedValue({ id: PHOTO.id, deleted: true })
    const res = await app.inject({ method: 'DELETE', url: `/v1/photos/${PHOTO.id}`, headers: { authorization: `Bearer ${token}` } })
    expect(res.json()).toEqual({ id: PHOTO.id, deleted: true })
    expect(remove).toHaveBeenCalledWith(PHOTO.id, me)
  })
})
