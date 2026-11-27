/**
 * RLS equivalence for the trail reads, against a real local Supabase.
 *
 * Creates throwaway users, follows, close friends, a community and trails of every
 * visibility, then for each kind of viewer checks that TrailsService returns exactly
 * what Supabase itself returns for the same token, matches an explicit expected
 * matrix, and only produces contract-valid JSON. Fixtures use random ids and are
 * deleted afterwards; the suite refuses to run against anything but localhost.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { TrailDetail, TrailList } from '@breadcrumb/contracts'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { TrailsService } from '../../src/trails/trails.service.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

type Persona = 'anon' | 'owner' | 'friend' | 'closeFriend' | 'stranger' | 'member' | 'privateOwner'
type TrailKey = 'public' | 'friends' | 'close' | 'draft' | 'archived' | 'community' | 'privatePublic' | 'remix'

const PEOPLE = ['owner', 'friend', 'closeFriend', 'stranger', 'member', 'privateOwner'] as const
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<(typeof PEOPLE)[number], string>
const trail = Object.fromEntries(
  (['public', 'friends', 'close', 'draft', 'archived', 'community', 'privatePublic', 'remix'] as TrailKey[]).map((k) => [k, randomUUID()]),
) as Record<TrailKey, string>
const communityId = randomUUID()
const tag = `rls-${randomUUID().slice(0, 8)}`

/** Which fixture trails each viewer should get from the feed (published only). */
const EXPECTED_FEED: Record<Persona, TrailKey[]> = {
  anon: ['public', 'remix'],
  owner: ['public', 'friends', 'close', 'community', 'remix'],
  friend: ['public', 'friends', 'privatePublic', 'remix'],
  closeFriend: ['public', 'friends', 'close', 'remix'],
  stranger: ['public', 'remix'],
  member: ['public', 'community', 'remix'],
  privateOwner: ['public', 'privatePublic', 'remix'],
}
/** Detail pages differ from the feed only in that creators also see their own drafts and archived trails. */
const EXPECTED_DETAIL: Record<Persona, TrailKey[]> = {
  ...EXPECTED_FEED,
  owner: [...EXPECTED_FEED.owner, 'draft', 'archived'],
}

let local: LocalSupabase
let db: pg.Client
let service: TrailsService
const users = {} as Record<Persona, AuthUser | null>

async function sql(text: string, values: unknown[] = []) {
  return db.query(text, values)
}

beforeAll(async () => {
  local = localSupabase()
  db = new pg.Client({ connectionString: local.dbUrl })
  await db.connect()

  await sql('begin')
  for (const person of PEOPLE) {
    await sql(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', $3, now(), now())`,
      [id[person], `${tag}-${person}@example.test`, JSON.stringify({ display_name: `${tag} ${person}` })],
    )
  }
  await sql(`insert into public.communities (id, name, slug) values ($1, $2, $2)`, [communityId, tag])
  await sql(`update public.profiles set username = $2 || '_' || substr(id::text, 1, 6) where id = any($1)`, [Object.values(id), tag.replace('-', '_')])
  await sql(`update public.profiles set community_id = $1 where id = $2`, [communityId, id.member])
  await sql(`update public.profiles set is_private = true where id = $1`, [id.privateOwner])
  const mutual = [
    [id.owner, id.friend],
    [id.owner, id.closeFriend],
    [id.privateOwner, id.friend],
  ]
  for (const [a, b] of mutual) {
    await sql(`insert into public.follows (follower_id, following_id) values ($1, $2), ($2, $1)`, [a, b])
  }
  await sql(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [id.stranger, id.owner]) // one-way: not a friend
  await sql(`insert into public.close_friends (owner_id, friend_id) values ($1, $2)`, [id.owner, id.closeFriend])

  const trails: [TrailKey, string, string, string, string | null, string | null][] = [
    ['public', id.owner, 'published', 'public', null, null],
    ['friends', id.owner, 'published', 'friends', null, null],
    ['close', id.owner, 'published', 'close_friends', null, null],
    ['draft', id.owner, 'draft', 'public', null, null],
    ['archived', id.owner, 'archived', 'public', null, null],
    ['community', id.owner, 'published', 'public', communityId, null],
    ['privatePublic', id.privateOwner, 'published', 'public', null, null],
    ['remix', id.friend, 'published', 'public', null, trail.friends], // the friend can see the original, so may remix it
  ]
  for (const [key, creator, status, visibility, community, remixedFrom] of trails) {
    // The remix check runs as the signed-in user (auth.uid()), so act as the creator for this insert.
    await sql(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: creator, role: 'authenticated' })])
    await sql(
      `insert into public.sidequests (id, creator_id, title, status, visibility, community_id, remixed_from, category, neighborhood, estimated_cost, estimated_duration_minutes)
       values ($1, $2, $3, $4, $5, $6, $7, 'outdoors', $8, 12, 90)`,
      [trail[key], creator, `${tag} ${key}`, status, visibility, community, remixedFrom, tag],
    )
  }
  await sql(`select set_config('request.jwt.claims', '', true)`)

  // Two stops (one at a late-night library place if one exists), crumbs and a review on the public trail.
  const late = await sql(`select id from public.experiences where open_late limit 1`)
  const stopA = randomUUID()
  const stopB = randomUUID()
  await sql(
    `insert into public.sidequest_stops (id, sidequest_id, stop_order, place_name, latitude, longitude, travel_mode_to_stop, estimated_cost, experience_id)
     values ($1, $3, 0, 'First stop', 42.35, -71.06, null, 5, null), ($2, $3, 1, 'Second stop', 42.36, -71.05, 'walk', 7, $4)`,
    [stopA, stopB, trail.public, late.rows[0]?.id ?? null],
  )
  await sql(
    `insert into public.checklist_items (sidequest_id, stop_id, label, item_type, item_order)
     values ($1, $2, 'Look up', 'see', 0), ($1, null, 'On the way', 'do', 1)`,
    [trail.public, stopA],
  )
  await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed')`, [id.friend, trail.public])
  await sql(
    `insert into public.sidequest_ratings (user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text)
     values ($1, $2, 4, 5, 4, 3, 'Nice walk')`,
    [id.friend, trail.public],
  )
  await sql('commit')

  const config = loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })
  service = new TrailsService(new SupabaseClients(config))

  users.anon = null
  for (const person of PEOPLE) {
    users[person] = {
      id: id[person],
      email: null,
      role: 'authenticated',
      aal: 'aal1',
      sessionId: null,
      isAnonymous: false,
      accessToken: await userToken(local, id[person]),
    }
  }
})

afterAll(async () => {
  if (!db) return
  await sql('rollback').catch(() => undefined)
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await sql(`delete from public.communities where id = $1`, [communityId])
  await db.end()
})

/** What Supabase itself returns for this caller, bypassing the API. */
function direct(user: AuthUser | null) {
  return createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: user ? { headers: { Authorization: `Bearer ${user.accessToken}` } } : undefined,
  })
}

const fixtureKeys = (ids: string[]) =>
  (Object.keys(trail) as TrailKey[]).filter((key) => ids.includes(trail[key])).sort()

const personas = Object.keys(EXPECTED_FEED) as Persona[]

describe.each(personas)('viewer: %s', (persona) => {
  it('feed matches Supabase exactly and the expected matrix', async () => {
    const user = users[persona]
    const viaApi = await service.list({}, user)
    const { data, error } = await direct(user).from('sidequests').select('id').eq('status', 'published')
    expect(error).toBeNull()

    expect(viaApi.map((t) => t.id).sort()).toEqual((data ?? []).map((r) => r.id).sort())
    expect(fixtureKeys(viaApi.map((t) => t.id))).toEqual([...EXPECTED_FEED[persona]].sort())
    expect(() => TrailList.parse({ trails: viaApi })).not.toThrow()
  })

  it('detail is visible exactly when Supabase shows the row', async () => {
    const user = users[persona]
    const visible: TrailKey[] = []
    for (const key of Object.keys(trail) as TrailKey[]) {
      const viaApi = await service.get(trail[key], user)
      const { data } = await direct(user).from('sidequests').select('id').eq('id', trail[key]).maybeSingle()
      expect(viaApi === null, `${persona} → ${key}`).toBe(data === null)
      if (viaApi) {
        expect(() => TrailDetail.parse(viaApi)).not.toThrow()
        visible.push(key)
      }
    }
    expect(visible.sort()).toEqual([...EXPECTED_DETAIL[persona]].sort())
  })
})

describe('details and filters', () => {
  it('maps stops, crumbs, reviews and rating stats', async () => {
    const detail = await service.get(trail.public, users.stranger)
    expect(detail).not.toBeNull()
    expect(detail!.stops.map((s) => s.placeName)).toEqual(['First stop', 'Second stop'])
    expect(detail!.stops[0].crumbs.map((c) => c.label)).toEqual(['Look up'])
    expect(detail!.betweenStopCrumbs.map((c) => c.label)).toEqual(['On the way'])
    expect(detail!.reviews).toHaveLength(1)
    expect(detail!.reviews[0]).toMatchObject({ overall: 4, text: 'Nice walk' })
    expect(detail!.rating).toMatchObject({ count: 1, average: 4, price: 4, time: 5, enjoyment: 4, memorability: 3 })
    expect(detail).toMatchObject({ stopCount: 2, crumbCount: 2, firstStopName: 'First stop', lastStopName: 'Second stop', estimatedCost: 12 })
  })

  it('credits a remix source only for viewers who can see the original', async () => {
    expect((await service.get(trail.remix, users.stranger))!.remixedFrom).toBeNull()
    expect((await service.get(trail.remix, users.anon))!.remixedFrom).toBeNull()
    expect((await service.get(trail.remix, users.closeFriend))!.remixedFrom).toMatchObject({ id: trail.friends })
  })

  it('community filter returns the community trail only to members and the creator', async () => {
    const ids = async (persona: Persona) => (await service.list({ communityId }, users[persona])).map((t) => t.id)
    expect(await ids('member')).toEqual([trail.community])
    expect(await ids('owner')).toEqual([trail.community])
    expect(await ids('stranger')).toEqual([])
    expect(await ids('anon')).toEqual([])
  })

  it('neighborhood, cost and length filters narrow the feed', async () => {
    const feed = (filters: Parameters<TrailsService['list']>[0]) => service.list({ neighborhood: tag, ...filters }, users.owner)
    expect((await feed({})).length).toBe(EXPECTED_FEED.owner.length)
    expect(await feed({ maxCost: 11 })).toEqual([])
    expect(await feed({ minCost: 13 })).toEqual([])
    expect((await feed({ maxMinutes: 90 })).length).toBe(EXPECTED_FEED.owner.length)
    expect(await feed({ maxMinutes: 89 })).toEqual([])
    expect(await feed({ category: 'food_drink' })).toEqual([])
  })

  it('late-night filter keeps a trail only if one of its stops is open late', async () => {
    const late = await sql(`select 1 from public.experiences where open_late limit 1`)
    const ids = (await service.list({ neighborhood: tag, lateNight: true }, users.owner)).map((t) => t.id)
    expect(ids).toEqual(late.rowCount ? [trail.public] : [])
  })

  it('feed places carry each stop’s travel mode, for map thumbnails', async () => {
    const feed = await service.list({ neighborhood: tag }, users.owner)
    const places = feed.find((t) => t.id === trail.public)?.places ?? []
    expect(places.map((p) => [p.name, p.travelModeToStop])).toEqual([
      ['First stop', null],
      ['Second stop', 'walk'],
    ])
  })

  it('an unknown id is null, not an error', async () => {
    expect(await service.get(randomUUID(), users.owner)).toBeNull()
  })
})
