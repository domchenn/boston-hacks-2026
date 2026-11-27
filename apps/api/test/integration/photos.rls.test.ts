/**
 * Trail photos against a real local Supabase, Storage included. A phone photo with
 * GPS is stored as a clean, shrunk JPEG under the uploader's own folder and recorded
 * with a URL the API built; the stored file has no metadata. Uploading to a trail
 * you haven't saved or started is 403 and stores nothing; a stop from another trail
 * is 422 and the file is removed again; a non-image is 415. Listing equals the web's
 * query for each viewer (friends-only photos stay hidden). Only the uploader can
 * delete, and the file goes with the row. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ForbiddenException, NotFoundException, UnprocessableEntityException, UnsupportedMediaTypeException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { PhotosService } from '../../src/photos/photos.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

/** creator ⇄ friend (mutual); stranger: nothing. */
const PEOPLE = ['creator', 'friend', 'stranger'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const trail = { open: randomUUID(), friendsOnly: randomUUID(), other: randomUUID() }
const stop = { open: randomUUID(), other: randomUUID() }

let local: LocalSupabase
let db: pg.Client
let service: PhotosService
let phone: Buffer
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
const objectsOf = async (p: Person) =>
  (await sql(`select name from storage.objects where bucket_id = 'trail-photos' and name like $1`, [`${id[p]}/%`])).rows.map((r) => r.name as string)

function direct(user: AuthUser | null) {
  return createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: user ? { headers: { Authorization: `Bearer ${user.accessToken}` } } : undefined,
  })
}

beforeAll(async () => {
  local = localSupabase()
  db = new pg.Client({ connectionString: local.dbUrl })
  await db.connect()
  await sql('begin')
  for (const p of PEOPLE) {
    await sql(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now())`,
      [id[p], `rls-${tag}-${p}@example.test`],
    )
  }
  await sql(`insert into public.follows (follower_id, following_id) values ($1, $2), ($2, $1)`, [id.creator, id.friend])
  await sql(
    `insert into public.sidequests (id, creator_id, title, status, visibility) values
       ($1, $4, $5, 'published', 'public'), ($2, $4, $5, 'published', 'friends'), ($3, $4, $5, 'published', 'public')`,
    [trail.open, trail.friendsOnly, trail.other, id.creator, `${tag} trail`],
  )
  await sql(`insert into public.sidequest_stops (id, sidequest_id, place_name, stop_order) values ($1, $2, 'Here', 0), ($3, $4, 'Elsewhere', 0)`, [
    stop.open,
    trail.open,
    stop.other,
    trail.other,
  ])
  // The friend saved the open trail and finished the friends-only one; the stranger has nothing.
  await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'saved'), ($1, $3, 'completed')`, [
    id.friend,
    trail.open,
    trail.friendsOnly,
  ])
  await sql('commit')
  service = new PhotosService(new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })))
  for (const p of PEOPLE) {
    users[p] = {
      id: id[p],
      email: null,
      role: 'authenticated',
      aal: 'aal1',
      sessionId: null,
      isAnonymous: false,
      accessToken: await userToken(local, id[p]),
    }
  }
  phone = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: '#55aa33' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '42/1 21/1 0/1' } })
    .toBuffer()
})

afterAll(async () => {
  if (!db) return
  await sql('rollback').catch(() => undefined)
  for (const p of PEOPLE) {
    const names = await objectsOf(p)
    if (names.length > 0) await direct(users[p]).storage.from('trail-photos').remove(names)
  }
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('uploading', () => {
  it('stores a clean, shrunk JPEG under your folder and records it', async () => {
    const photo = await service.add(trail.open, phone, { caption: '  At the park  ', stopId: stop.open }, users.friend)
    expect(photo).toMatchObject({ caption: 'At the park', stopId: stop.open, uploader: { id: id.friend } })
    expect(photo.url).toContain(`/object/public/trail-photos/${id.friend}/trails/${trail.open}/`)
    const stored = Buffer.from(await (await fetch(photo.url)).arrayBuffer())
    const meta = await sharp(stored).metadata()
    expect(meta.format).toBe('jpeg')
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
    expect(meta.exif).toBeUndefined()
    expect(stored.includes(Buffer.from('TestPhone'))).toBe(false)
    const row = (await sql(`select photo_url, user_id from public.quest_photos where id = $1`, [photo.id])).rows[0]
    expect(row).toEqual({ photo_url: photo.url, user_id: id.friend })
  })

  it('a trail you haven’t saved or started is 403 and stores nothing', async () => {
    await expect(service.add(trail.open, phone, {}, users.stranger)).rejects.toBeInstanceOf(ForbiddenException)
    expect(await objectsOf('stranger')).toEqual([])
  })

  it('a stop from another trail is 422 and the file is removed again', async () => {
    const before = await objectsOf('friend')
    await expect(service.add(trail.open, phone, { stopId: stop.other }, users.friend)).rejects.toBeInstanceOf(UnprocessableEntityException)
    expect(await objectsOf('friend')).toEqual(before)
  })

  it('a file that isn’t an image is 415 and stores nothing', async () => {
    const before = await objectsOf('friend')
    await expect(service.add(trail.open, Buffer.from('not an image'), {}, users.friend)).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
    expect(await objectsOf('friend')).toEqual(before)
  })
})

describe('listing', () => {
  it.each([null, 'creator', 'friend', 'stranger'] as const)('for %s equals the web query', async (p) => {
    await service.add(trail.friendsOnly, phone, {}, users.friend).catch(() => undefined)
    const user = p ? users[p] : null
    for (const t of [trail.open, trail.friendsOnly]) {
      const { data } = await direct(user).from('quest_photos').select('id').eq('sidequest_id', t).order('created_at', { ascending: false })
      expect((await service.list(t, user)).map((x) => x.id)).toEqual((data ?? []).map((r) => r.id))
    }
  })

  it('friends-only photos are hidden from people who can’t see the trail', async () => {
    expect((await service.list(trail.friendsOnly, users.creator)).length).toBeGreaterThan(0)
    expect(await service.list(trail.friendsOnly, users.stranger)).toEqual([])
    expect(await service.list(trail.friendsOnly, null)).toEqual([])
  })
})

describe('deleting', () => {
  it('only the uploader can delete; the file goes with the row', async () => {
    const photo = await service.add(trail.open, phone, {}, users.friend)
    const path = photo.url.split('/object/public/trail-photos/')[1]!
    await expect(service.remove(photo.id, users.creator)).rejects.toBeInstanceOf(NotFoundException)
    expect(await objectsOf('friend')).toContain(path)
    expect(await service.remove(photo.id, users.friend)).toEqual({ id: photo.id, deleted: true })
    expect((await sql(`select 1 from public.quest_photos where id = $1`, [photo.id])).rowCount).toBe(0)
    expect(await objectsOf('friend')).not.toContain(path)
  })
})
