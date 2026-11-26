/**
 * Creating and editing trails against a real local Supabase. The API calls
 * save_trail() as the caller, so for the same payload it must store exactly what a
 * direct save_trail() call stores, and enforce the same rules: the publish
 * checklist, at most 8 stops, editing only your own trail, sharing only with your
 * own community, remixing only what you can see, and replacing stops on edit.
 * Throwaway users and trails, deleted afterwards; localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import type { SaveTrailBody } from '@breadcrumb/contracts'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { TrailWritesService } from '../../src/trails/trail-writes.service.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['owner', 'other'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const community = randomUUID()
const visibleSource = randomUUID()
const hiddenSource = randomUUID()

let local: LocalSupabase
let db: pg.Client
let service: TrailWritesService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)

const stop = (n: number, extra: Partial<SaveTrailBody['stops'][number]> = {}) => ({
  place_name: `${tag} stop ${n}`,
  address: `${n} Main St`,
  latitude: 42.35 + n / 1000,
  longitude: -71.06,
  travel_mode_to_stop: n === 0 ? null : ('walk' as const),
  estimated_cost: n,
  crumb: n % 2 === 0 ? `crumb ${n}` : '',
  ...extra,
})
const published = (stops = 3, extra: Partial<SaveTrailBody> = {}): SaveTrailBody => ({
  title: `${tag} trail`,
  description: 'A test trail',
  category: 'outdoors',
  status: 'published',
  estimated_cost: 6,
  estimated_duration_minutes: 90,
  neighborhood: 'Fenway',
  visibility: 'public',
  stops: Array.from({ length: stops }, (_, i) => stop(i)),
  ...extra,
})

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
  await sql(`insert into public.communities (id, name, slug) values ($1, $2, $2)`, [community, `rls-${tag}`])
  await sql(`update public.profiles set community_id = $1 where id = $2`, [community, id.owner])
  await sql(
    `insert into public.sidequests (id, creator_id, title, status, visibility) values
       ($1, $3, $4, 'published', 'public'), ($2, $3, $5, 'published', 'friends')`,
    [visibleSource, hiddenSource, id.other, `${tag} visible source`, `${tag} hidden source`],
  )
  await sql('commit')
  service = new TrailWritesService(
    new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })),
  )
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
  await sql(`delete from public.communities where id = $1`, [community])
  await db.end()
})

/** save_trail() called directly as the user, bypassing the API. */
async function direct(user: AuthUser, body: SaveTrailBody, trailId: string | null = null) {
  const client = createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
  })
  return client.rpc('save_trail', { p_trail: body, ...(trailId ? { p_trail_id: trailId } : {}) })
}

/** Everything save_trail() stored for a trail, without ids and timestamps. */
async function stored(trailId: string) {
  const trail = await sql(
    `select creator_id, title, description, category, custom_category, status, estimated_cost::text, estimated_duration_minutes,
            neighborhood, community_id, remixed_from, visibility
     from public.sidequests where id = $1`,
    [trailId],
  )
  const stops = await sql(
    `select stop_order, place_name, address, latitude, longitude, travel_mode_to_stop, estimated_cost::text,
            (select array_agg(label order by item_order) from public.checklist_items c where c.stop_id = s.id) as crumbs
     from public.sidequest_stops s where sidequest_id = $1 order by stop_order`,
    [trailId],
  )
  return { trail: trail.rows[0], stops: stops.rows }
}

describe('same payload, same result', () => {
  it.each([
    ['a published trail', published(3)],
    ['a bare draft', { title: `${tag} draft`, status: 'draft', stops: [] } as SaveTrailBody],
    ['a community, friends-only trail', published(2, { community_id: community, visibility: 'friends' })],
    ['a remix of a visible trail', published(2, { remixed_from: visibleSource })],
  ])('%s: the API stores exactly what save_trail() stores directly', async (_label, body) => {
    const viaApi = await service.save(body, null, users.owner)
    const { data: directId, error } = await direct(users.owner, body)
    expect(error).toBeNull()
    expect(await stored(viaApi.id)).toEqual(await stored(directId as string))
  })
})

describe('publish checklist and limits (422 with the database message)', () => {
  it.each([
    ['no name', published(3, { title: '   ' }), 'Give your trail a name'],
    ['no category', published(3, { category: null }), 'Pick a category before publishing'],
    ['"other" without a name', published(3, { category: 'other', custom_category: '' }), 'Type your own category before publishing'],
    ['one stop', published(1), 'Add at least 2 stops before publishing'],
    ['nine stops', published(9), 'A trail can have at most 8 stops'],
  ])('%s', async (_label, body, message) => {
    const attempt = service.save(body, null, users.owner)
    await expect(attempt).rejects.toBeInstanceOf(UnprocessableEntityException)
    await expect(attempt).rejects.toThrow(message)
    const { error } = await direct(users.owner, body)
    expect(error?.message).toBe(message)
  })

  it('a draft may be incomplete', async () => {
    await expect(service.save(published(1, { status: 'draft', category: null }), null, users.owner)).resolves.toHaveProperty('id')
  })
})

describe('editing', () => {
  it('replaces the stops and crumbs, keeping visibility when the key is absent', async () => {
    const { id: trailId } = await service.save(published(3, { visibility: 'friends' }), null, users.owner)
    const before = await sql(`select id from public.sidequest_stops where sidequest_id = $1`, [trailId])
    const { visibility: _v, ...withoutVisibility } = published(2, { title: `${tag} renamed` })
    void _v
    await service.save(withoutVisibility, trailId, users.owner)
    const after = await stored(trailId)
    expect(after.trail).toMatchObject({ title: `${tag} renamed`, visibility: 'friends' })
    expect(after.stops.map((s) => s.place_name)).toEqual([`${tag} stop 0`, `${tag} stop 1`])
    const left = await sql(`select 1 from public.sidequest_stops where id = any($1)`, [before.rows.map((r) => r.id)])
    expect(left.rowCount).toBe(0)
  })

  it("someone else's trail is 403 and stays unchanged", async () => {
    const { id: trailId } = await service.save(published(2), null, users.owner)
    const before = await stored(trailId)
    await expect(service.save(published(3, { title: 'hijacked' }), trailId, users.other)).rejects.toBeInstanceOf(ForbiddenException)
    expect(await stored(trailId)).toEqual(before)
  })

  it('a trail id that does not exist is 403 (save_trail cannot tell missing from not yours)', async () => {
    await expect(service.save(published(2), randomUUID(), users.owner)).rejects.toBeInstanceOf(ForbiddenException)
  })
})

describe('sharing and remix rules (403)', () => {
  it("only your own community: a non-member can't limit a trail to it", async () => {
    await expect(service.save(published(2, { community_id: community }), null, users.other)).rejects.toThrow(
      'You can only share a trail with your own community',
    )
  })

  it("can't remix a trail you can't see, and nothing is stored", async () => {
    const before = await sql(`select count(*)::int as n from public.sidequests where creator_id = $1`, [id.owner])
    await expect(service.save(published(2, { remixed_from: hiddenSource }), null, users.owner)).rejects.toBeInstanceOf(ForbiddenException)
    const after = await sql(`select count(*)::int as n from public.sidequests where creator_id = $1`, [id.owner])
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('a place id that does not exist is 422, and the whole save rolls back', async () => {
    const before = await sql(`select count(*)::int as n from public.sidequests where creator_id = $1`, [id.owner])
    const body = published(2, { stops: [stop(0), stop(1, { experience_id: randomUUID() })] })
    await expect(service.save(body, null, users.owner)).rejects.toBeInstanceOf(UnprocessableEntityException)
    const after = await sql(`select count(*)::int as n from public.sidequests where creator_id = $1`, [id.owner])
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })
})
