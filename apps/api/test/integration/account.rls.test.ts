/**
 * Self-serve account deletion against a real local Supabase, Storage included. One
 * person ("leaver") has a trail with a friend's photo on it, a photo on someone
 * else's trail and an older file in the public bucket, and filed a report. Deleting
 * their account removes the sign-in account, the profile, the trail and all those
 * photo files, keeps the report without a reporter, and leaves everyone else alone.
 * Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { AccountService } from '../../src/account/account.service.js'
import { loadConfig } from '../../src/config/env.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['leaver', 'friend', 'stayer'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
/** The leaver's trail, and the stayer's trail. */
const trail = { mine: randomUUID(), theirs: randomUUID() }
const file = {
  friendOnMine: `${trail.mine}/${randomUUID()}.jpg`,
  mineOnTheirs: `${trail.theirs}/${randomUUID()}.jpg`,
  stayerOnTheirs: `${trail.theirs}/${randomUUID()}.jpg`,
  legacy: `${id.leaver}/crumbs/${tag}/old.jpg`,
}
const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })

let local: LocalSupabase
let db: pg.Client
let service: AccountService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
const storage = (p: Person, bucket: string) =>
  createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${users[p].accessToken}` } },
  }).storage.from(bucket)
const exists = async (bucket: string, name: string) =>
  (await sql(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name])).rowCount === 1
const count = async (text: string, values: unknown[]) => Number((await sql(text, values)).rows[0].n)

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
  await sql(`insert into public.follows (follower_id, following_id) values ($1, $2), ($2, $1)`, [id.leaver, id.friend])
  await sql(`insert into public.sidequests (id, creator_id, title, status) values ($1, $2, $4, 'published'), ($3, $5, $4, 'published')`, [
    trail.mine,
    id.leaver,
    trail.theirs,
    `${tag} trail`,
    id.stayer,
  ])
  await sql(
    `insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed'), ($3, $4, 'completed'), ($5, $4, 'completed')`,
    [id.friend, trail.mine, id.leaver, trail.theirs, id.stayer],
  )
  for (const [p, bucket, name] of [
    ['friend', 'photos', file.friendOnMine],
    ['leaver', 'photos', file.mineOnTheirs],
    ['stayer', 'photos', file.stayerOnTheirs],
    ['leaver', 'trail-photos', file.legacy],
  ] as const) {
    const { error } = await storage(p, bucket).upload(name, JPEG)
    if (error) throw error
  }
  await sql(
    `insert into public.quest_photos (user_id, sidequest_id, storage_path) values ($1, $2, $3), ($4, $5, $6), ($7, $5, $8)`,
    [id.friend, trail.mine, file.friendOnMine, id.leaver, trail.theirs, file.mineOnTheirs, id.stayer, file.stayerOnTheirs],
  )
  await sql(`insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'trail', $2, 'spam')`, [id.leaver, trail.theirs])
  service = new AccountService(new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })))
})

afterAll(async () => {
  if (!db) return
  for (const [p, bucket, name] of [
    ['friend', 'photos', file.friendOnMine],
    ['stayer', 'photos', file.stayerOnTheirs],
  ] as const) {
    if (await exists(bucket, name)) await storage(p, bucket).remove([name])
  }
  await sql(`delete from public.reports where target_id = $1`, [trail.theirs])
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('deleting your account', () => {
  it('removes your account, your trail and every photo file tied to you; keeps your report without your name', async () => {
    expect(await service.deleteAccount(users.leaver)).toEqual({ deleted: true })

    expect(await count(`select count(*) as n from auth.users where id = $1`, [id.leaver])).toBe(0)
    expect(await count(`select count(*) as n from public.profiles where id = $1`, [id.leaver])).toBe(0)
    expect(await count(`select count(*) as n from public.sidequests where id = $1`, [trail.mine])).toBe(0)
    expect(await count(`select count(*) as n from public.quest_photos where user_id = $1 or sidequest_id = $2`, [id.leaver, trail.mine])).toBe(0)

    expect(await exists('photos', file.friendOnMine)).toBe(false)
    expect(await exists('photos', file.mineOnTheirs)).toBe(false)
    expect(await exists('trail-photos', file.legacy)).toBe(false)

    expect((await sql(`select reporter_id from public.reports where target_id = $1`, [trail.theirs])).rows).toEqual([{ reporter_id: null }])
  })

  it('leaves everyone else alone', async () => {
    expect(await count(`select count(*) as n from public.profiles where id = any($1)`, [[id.friend, id.stayer]])).toBe(2)
    expect(await count(`select count(*) as n from public.sidequests where id = $1`, [trail.theirs])).toBe(1)
    expect(await exists('photos', file.stayerOnTheirs)).toBe(true)
    expect(await count(`select count(*) as n from public.quest_photos where user_id = $1`, [id.stayer])).toBe(1)
  })
})
