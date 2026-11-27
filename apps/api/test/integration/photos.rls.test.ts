/**
 * Trail photos against a real local Supabase, Storage included. A phone photo with
 * GPS is stored as a clean, shrunk JPEG in the private `photos` bucket under the
 * trail's folder with a random name (no user id), served by a signed link that only
 * people who can see the trail get; its public link doesn't work. Older photos keep
 * their public link. Deleting a trail removes everyone's photo files on it. Uploading to a trail
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
import { TrailWritesService } from '../../src/trails/trail-writes.service.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

/** creator ⇄ friend (mutual); stranger: nothing. */
const PEOPLE = ['creator', 'friend', 'stranger'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const trail = { open: randomUUID(), friendsOnly: randomUUID(), other: randomUUID(), doomed: randomUUID() }
const stop = { open: randomUUID(), other: randomUUID() }

let local: LocalSupabase
let db: pg.Client
let service: PhotosService
let phone: Buffer
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
/** Files the person uploaded to the private bucket. */
const objectsOf = async (p: Person) =>
  (await sql(`select name from storage.objects where bucket_id = 'photos' and owner_id = $1 order by name`, [id[p]])).rows.map((r) => r.name as string)
const filesIn = async (trailId: string) =>
  (await sql(`select name from storage.objects where bucket_id = 'photos' and name like $1`, [`${trailId}/%`])).rows.map((r) => r.name as string)
let writes: TrailWritesService

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
       ($1, $4, $5, 'published', 'public'), ($2, $4, $5, 'published', 'friends'), ($3, $4, $5, 'published', 'public'),
       ($6, $4, $5, 'published', 'public')`,
    [trail.open, trail.friendsOnly, trail.other, id.creator, `${tag} trail`, trail.doomed],
  )
  await sql(`insert into public.sidequest_stops (id, sidequest_id, place_name, stop_order) values ($1, $2, 'Here', 0), ($3, $4, 'Elsewhere', 0)`, [
    stop.open,
    trail.open,
    stop.other,
    trail.other,
  ])
  // The friend saved the open trail, finished the friends-only one and the doomed one; the stranger has nothing.
  await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'saved'), ($1, $3, 'completed'), ($1, $4, 'completed')`, [
    id.friend,
    trail.open,
    trail.friendsOnly,
    trail.doomed,
  ])
  await sql('commit')
  const clients = new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey }))
  service = new PhotosService(clients)
  writes = new TrailWritesService(clients)
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
    if (names.length > 0) await direct(users[p]).storage.from('photos').remove(names)
  }
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('uploading', () => {
  it('stores a clean, shrunk JPEG privately under the trail with a random name, served by a signed link', async () => {
    const photo = await service.add(trail.open, phone, { caption: '  At the park  ', stopId: stop.open }, users.friend)
    expect(photo).toMatchObject({ caption: 'At the park', stopId: stop.open, uploader: { id: id.friend } })
    expect(photo.url).toContain(`/object/sign/photos/${trail.open}/`)
    expect(photo.url).not.toContain(id.friend)
    const [name] = await objectsOf('friend')
    expect(name).toMatch(new RegExp(`^${trail.open}/[0-9a-f-]{36}\\.jpg$`))
    expect((await fetch(`${local.url}/storage/v1/object/public/photos/${name}`)).ok).toBe(false)
    const stored = Buffer.from(await (await fetch(photo.url)).arrayBuffer())
    const meta = await sharp(stored).metadata()
    expect(meta.format).toBe('jpeg')
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
    expect(meta.exif).toBeUndefined()
    expect(stored.includes(Buffer.from('TestPhone'))).toBe(false)
    const row = (await sql(`select photo_url, storage_path, user_id from public.quest_photos where id = $1`, [photo.id])).rows[0]
    expect(row).toEqual({ photo_url: null, storage_path: name, user_id: id.friend })
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

  it('friends-only photos are hidden from people who can’t see the trail, even by direct link', async () => {
    expect((await service.list(trail.friendsOnly, users.creator)).length).toBeGreaterThan(0)
    expect(await service.list(trail.friendsOnly, users.stranger)).toEqual([])
    expect(await service.list(trail.friendsOnly, null)).toEqual([])
    const [file] = await filesIn(trail.friendsOnly)
    const signed = await direct(users.stranger).storage.from('photos').createSignedUrl(file!, 60)
    expect(signed.data?.signedUrl ?? null).toBeNull()
    expect((await fetch(`${local.url}/storage/v1/object/public/photos/${file}`)).ok).toBe(false)
  })

  it('an older photo keeps its public link', async () => {
    const legacy = randomUUID()
    await sql(`insert into public.quest_photos (id, user_id, sidequest_id, photo_url) values ($1, $2, $3, 'https://example.test/old.jpg')`, [
      legacy,
      id.friend,
      trail.open,
    ])
    expect((await service.list(trail.open, null)).find((p) => p.id === legacy)?.url).toBe('https://example.test/old.jpg')
    await sql(`delete from public.quest_photos where id = $1`, [legacy])
  })
})

describe('deleting', () => {
  it('only the uploader can delete; the file goes with the row', async () => {
    const photo = await service.add(trail.open, phone, {}, users.friend)
    const path = (await sql(`select storage_path from public.quest_photos where id = $1`, [photo.id])).rows[0].storage_path as string
    await expect(service.remove(photo.id, users.creator)).rejects.toBeInstanceOf(NotFoundException)
    expect(await objectsOf('friend')).toContain(path)
    expect(await service.remove(photo.id, users.friend)).toEqual({ id: photo.id, deleted: true })
    expect((await sql(`select 1 from public.quest_photos where id = $1`, [photo.id])).rowCount).toBe(0)
    expect(await objectsOf('friend')).not.toContain(path)
  })

  it('deleting a trail removes everyone’s photo files on it', async () => {
    await service.add(trail.doomed, phone, {}, users.friend)
    expect(await filesIn(trail.doomed)).toHaveLength(1)
    await expect(writes.remove(trail.doomed, users.friend)).rejects.toBeInstanceOf(NotFoundException)
    expect(await filesIn(trail.doomed)).toHaveLength(1)
    await writes.remove(trail.doomed, users.creator)
    expect(await filesIn(trail.doomed)).toEqual([])
  })
})
