/**
 * Moving older public photos into private storage, against a real local Supabase
 * with Storage. A non-moderator gets 403 and nothing moves. A moderator's run moves
 * an older photo (GPS and all) into the private bucket as a clean JPEG under its
 * trail, points the row at it, deletes the old public file and leaves the uploader as
 * the owner (they can still delete it); a photo whose link isn't in our storage is
 * skipped with a reason; running it again moves nothing more. Throwaway data.
 */
import { randomUUID } from 'node:crypto'
import { ForbiddenException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { ModerationService } from '../../src/moderation/moderation.service.js'
import { PhotosService } from '../../src/photos/photos.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['uploader', 'moderator'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const trail = randomUUID()
const photo = { stored: randomUUID(), external: randomUUID() }
const oldPath = `${id.uploader}/trails/${trail}/${tag}.jpg`

let local: LocalSupabase
let db: pg.Client
let moderation: ModerationService
let photos: PhotosService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
const storage = (p: Person, bucket: string) =>
  createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${users[p].accessToken}` } },
  }).storage.from(bucket)
const row = async (photoId: string) => (await sql(`select storage_path, photo_url from public.quest_photos where id = $1`, [photoId])).rows[0]
const object = async (bucket: string, name: string) =>
  (await sql(`select owner_id from storage.objects where bucket_id = $1 and name = $2`, [bucket, name])).rows[0] as { owner_id: string } | undefined

beforeAll(async () => {
  local = localSupabase()
  db = new pg.Client({ connectionString: local.dbUrl })
  await db.connect()
  for (const p of PEOPLE) {
    await sql(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now())`,
      [id[p], `rls-${tag}-${p}@example.test`],
    )
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
  await sql(`update public.profiles set is_admin = true where id = $1`, [id.moderator])
  await sql(`insert into public.sidequests (id, creator_id, title, status, visibility) values ($1, $2, $3, 'published', 'friends')`, [trail, id.moderator, `${tag} trail`])
  await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed')`, [id.uploader, trail])
  const phone = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#aa5533' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '42/1 21/1 0/1' } })
    .toBuffer()
  const uploaded = await storage('uploader', 'trail-photos').upload(oldPath, phone, { contentType: 'image/jpeg' })
  if (uploaded.error) throw uploaded.error
  const url = storage('uploader', 'trail-photos').getPublicUrl(oldPath).data.publicUrl
  await sql(`insert into public.quest_photos (id, user_id, sidequest_id, photo_url) values ($1, $3, $4, $5), ($2, $3, $4, 'https://example.test/elsewhere.jpg')`, [
    photo.stored,
    photo.external,
    id.uploader,
    trail,
    url,
  ])
  const clients = new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey }))
  moderation = new ModerationService(clients)
  photos = new PhotosService(clients)
})

afterAll(async () => {
  if (!db) return
  if (await object('trail-photos', oldPath)) await storage('uploader', 'trail-photos').remove([oldPath])
  const { rows } = await sql(`select name from storage.objects where bucket_id = 'photos' and name like $1`, [`${trail}/%`])
  if (rows.length > 0) await storage('moderator', 'photos').remove(rows.map((r) => r.name as string))
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('moving older photos', () => {
  it('a non-moderator gets 403 and nothing moves', async () => {
    await expect(moderation.moveOlderPhotos(users.uploader)).rejects.toBeInstanceOf(ForbiddenException)
    expect((await row(photo.stored)).storage_path).toBeNull()
  })

  it('a moderator moves an older photo into private storage, clean, owned by its uploader', async () => {
    const result = await moderation.moveOlderPhotos(users.moderator)
    expect(result.moved).toBeGreaterThanOrEqual(1)
    expect(result.skipped).toContainEqual({ photoId: photo.external, reason: expect.stringContaining('isn’t in the older photo storage') })

    const moved = await row(photo.stored)
    expect(moved.photo_url).toBeNull()
    expect(moved.storage_path).toMatch(new RegExp(`^${trail}/[0-9a-f-]{36}\\.jpg$`))
    expect(await object('trail-photos', oldPath)).toBeUndefined()
    expect((await object('photos', moved.storage_path))?.owner_id).toBe(id.uploader)

    const [listed] = (await photos.list(trail, users.moderator)).filter((p) => p.id === photo.stored)
    const bytes = Buffer.from(await (await fetch(listed!.url)).arrayBuffer())
    const meta = await sharp(bytes).metadata()
    expect(meta.exif).toBeUndefined()
    expect(Math.max(meta.width!, meta.height!)).toBe(1600)
  })

  it('running it again moves nothing more', async () => {
    const again = await moderation.moveOlderPhotos(users.moderator)
    expect(again.skipped.map((s) => s.photoId)).toContain(photo.external)
    expect(again.skipped.map((s) => s.photoId)).not.toContain(photo.stored)
  })

  it('the uploader can still delete their moved photo, file included', async () => {
    const path = (await row(photo.stored)).storage_path as string
    await photos.remove(photo.stored, users.uploader)
    expect(await object('photos', path)).toBeUndefined()
  })
})
