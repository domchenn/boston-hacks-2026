/**
 * The trail-photos bucket through the real Storage API (local Supabase): nobody can
 * list other people's files (visitors list nothing at all), photo links still open
 * for everyone, and only the uploader can delete a file. Guards the
 * stop_public_photo_listing migration. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['owner', 'other'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const BUCKET = 'trail-photos'

let local: LocalSupabase
let db: pg.Client
const tokens = {} as Record<Person, string>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
const as = (p: Person | null) =>
  createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: p ? { headers: { Authorization: `Bearer ${tokens[p]}` } } : undefined,
  }).storage.from(BUCKET)
const exists = async (path: string) =>
  (await sql(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [BUCKET, path])).rowCount === 1

/** A tiny valid JPEG is not needed: Storage only checks the declared type and size. */
const FILE = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
const path = () => `${id.owner}/trails/${tag}/${randomUUID()}.jpg`

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
    tokens[p] = await userToken(local, id[p])
  }
})

afterAll(async () => {
  if (!db) return
  const { rows } = await sql(`select name from storage.objects where bucket_id = $1 and name like $2`, [BUCKET, `${id.owner}/%`])
  if (rows.length > 0) await as('owner').remove(rows.map((r) => r.name as string))
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('trail-photos bucket', () => {
  it('nobody else can list your files; visitors list nothing', async () => {
    const file = path()
    expect((await as('owner').upload(file, FILE)).error).toBeNull()
    const folder = `${id.owner}/trails/${tag}`
    expect((await as('owner').list(folder)).data?.length).toBeGreaterThan(0)
    expect((await as('other').list(folder)).data ?? []).toEqual([])
    expect((await as(null).list(folder)).data ?? []).toEqual([])
    expect((await as(null).list('')).data ?? []).toEqual([])
  })

  it('photo links still open for everyone', async () => {
    const file = path()
    await as('owner').upload(file, FILE)
    const url = as(null).getPublicUrl(file).data.publicUrl
    expect((await fetch(url)).status).toBe(200)
  })

  it('only the uploader can delete a file', async () => {
    const file = path()
    await as('owner').upload(file, FILE)
    await as('other').remove([file])
    await as(null).remove([file])
    expect(await exists(file)).toBe(true)
    expect((await as('owner').remove([file])).error).toBeNull()
    expect(await exists(file)).toBe(false)
  })

  it('nobody can upload into someone else’s folder', async () => {
    const file = path()
    expect((await as('other').upload(file, FILE)).error).not.toBeNull()
    expect(await exists(file)).toBe(false)
  })
})
