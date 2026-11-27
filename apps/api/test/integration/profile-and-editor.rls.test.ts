/**
 * Profile fields and the trail editor's calls against a real local Supabase. Reading
 * and saving profile fields touches only your own row; a taken username is 409 and
 * changes nothing; a blank display name is stored as none. The stop library equals the web's query
 * for each viewer and is empty for a trail hidden from you. Only the creator can
 * unpublish or delete a trail (404 for anyone else, nothing changed); deleting takes
 * the stops with it. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { MyProfileService } from '../../src/profiles/my-profile.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { TrailWritesService } from '../../src/trails/trail-writes.service.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['creator', 'stranger'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().replace(/-/g, '').slice(0, 6)
const trail = { published: randomUUID(), draft: randomUUID(), doomed: randomUUID() }
const place = randomUUID()

let local: LocalSupabase
let db: pg.Client
let profiles: MyProfileService
let writes: TrailWritesService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
const status = async (t: string) => (await sql(`select status from public.sidequests where id = $1`, [t])).rows[0]?.status as string | undefined
const profileRow = async (p: Person) =>
  (await sql(`select username, display_name from public.profiles where id = $1`, [id[p]])).rows[0]

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
  await sql(`update public.profiles set username = $2 where id = $1`, [id.stranger, `rls_${tag}_taken`])
  await sql(`insert into public.experiences (id, name, neighborhood, category, latitude, longitude) values ($1, $2, 'Allston', 'food_drink', 42.35, -71.13)`, [place, `${tag} place`])
  await sql(
    `insert into public.sidequests (id, creator_id, title, status) values ($1, $4, $5, 'published'), ($2, $4, $5, 'draft'), ($3, $4, $5, 'published')`,
    [trail.published, trail.draft, trail.doomed, id.creator, `${tag} trail`],
  )
  await sql(
    `insert into public.sidequest_stops (sidequest_id, experience_id, place_name, stop_order) values
       ($1, $3, 'Library stop', 0), ($1, null, 'Typed stop', 1), ($2, $3, 'Draft stop', 0), ($4, null, 'Doomed stop', 0)`,
    [trail.published, trail.draft, place, trail.doomed],
  )
  await sql('commit')
  const clients = new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey }))
  profiles = new MyProfileService(clients)
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
})

afterAll(async () => {
  if (!db) return
  await sql('rollback').catch(() => undefined)
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await sql(`delete from public.experiences where id = $1`, [place])
  await db.end()
})

describe('profile fields', () => {
  it('saves your own fields, stores a blank name as none and reads them back', async () => {
    const saved = await profiles.update({ username: `rls_${tag}_me`, displayName: '  Sam  ' }, users.creator)
    expect(saved).toEqual({ username: `rls_${tag}_me`, displayName: 'Sam' })
    expect(await profiles.get(users.creator)).toEqual(saved)
    expect(await profileRow('creator')).toEqual({ username: `rls_${tag}_me`, display_name: 'Sam' })
    expect((await profiles.update({ username: `rls_${tag}_me`, displayName: '   ' }, users.creator)).displayName).toBeNull()
    expect((await profileRow('stranger')).username).toBe(`rls_${tag}_taken`)
  })

  it('a taken username is 409 and changes nothing', async () => {
    const before = await profileRow('creator')
    await expect(profiles.update({ username: `rls_${tag}_taken`, displayName: 'X' }, users.creator)).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(await profileRow('creator')).toEqual(before)
  })
})

describe('stop library', () => {
  it.each([null, 'creator', 'stranger'] as const)('for %s equals the web query', async (p) => {
    const user = p ? users[p] : null
    for (const t of [trail.published, trail.draft]) {
      const { data } = await direct(user).from('sidequest_stops').select('id, experience_id, experiences(neighborhood)').eq('sidequest_id', t)
      const expected = (data ?? []).map((r) => ({
        stopId: r.id,
        experienceId: r.experience_id,
        neighborhood: (r.experiences as unknown as { neighborhood: string | null } | null)?.neighborhood ?? null,
      }))
      expect(await writes.stopLibrary(t, user)).toEqual(expected)
    }
  })

  it('links library stops to their place and neighborhood; a draft is empty for others', async () => {
    const stops = await writes.stopLibrary(trail.published, null)
    expect(stops.map((s) => [s.experienceId, s.neighborhood]).sort()).toEqual([
      [place, 'Allston'],
      [null, null],
    ].sort())
    expect(await writes.stopLibrary(trail.draft, users.creator)).toHaveLength(1)
    expect(await writes.stopLibrary(trail.draft, users.stranger)).toEqual([])
  })
})

describe('unpublish and delete', () => {
  it('only the creator can unpublish; anyone else gets 404 and nothing changes', async () => {
    await expect(writes.unpublish(trail.published, users.stranger)).rejects.toBeInstanceOf(NotFoundException)
    expect(await status(trail.published)).toBe('published')
    expect(await writes.unpublish(trail.published, users.creator)).toEqual({ id: trail.published, status: 'draft' })
    expect(await status(trail.published)).toBe('draft')
    await expect(writes.unpublish(randomUUID(), users.creator)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('only the creator can delete; the stops go with it', async () => {
    await expect(writes.remove(trail.doomed, users.stranger)).rejects.toBeInstanceOf(NotFoundException)
    expect(await status(trail.doomed)).toBe('published')
    expect(await writes.remove(trail.doomed, users.creator)).toEqual({ id: trail.doomed, deleted: true })
    expect(await status(trail.doomed)).toBeUndefined()
    expect((await sql(`select count(*)::int as n from public.sidequest_stops where sidequest_id = $1`, [trail.doomed])).rows[0].n).toBe(0)
    await expect(writes.remove(trail.doomed, users.creator)).rejects.toBeInstanceOf(NotFoundException)
  })
})
