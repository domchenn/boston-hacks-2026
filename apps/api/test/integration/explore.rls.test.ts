/**
 * Explore, badges and communities against a real local Supabase. For each kind of
 * viewer, Trending and the neighborhood list from the API equal what Supabase returns
 * for the same token, and a friends-only trail shows up only for the creator's friend.
 * Finished trails (badges) are yours only, include a trail hidden from you since
 * (without line or neighborhood) and leave out unfinished ones. Joining and leaving a
 * community changes only your own profile; an unknown community is a 422.
 * Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { UnprocessableEntityException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { CommunitiesService } from '../../src/communities/communities.service.js'
import { loadConfig } from '../../src/config/env.js'
import { ExploreService } from '../../src/explore/explore.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['creator', 'friend', 'stranger', 'actor1', 'actor2'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const trail = { open: randomUUID(), friendsOnly: randomUUID(), unfinished: randomUUID() }
const hood = { open: `${tag} Open Hood`, friendsOnly: `${tag} Friends Hood` }

let local: LocalSupabase
let db: pg.Client
let explore: ExploreService
let communities: CommunitiesService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)

/** What Supabase itself returns for this caller, bypassing the API. */
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
  // Friends = mutual follows. The stranger follows the creator one way only.
  await sql(`insert into public.follows (follower_id, following_id) values ($1, $2), ($2, $1), ($3, $1)`, [id.creator, id.friend, id.stranger])
  await sql(
    `insert into public.sidequests (id, creator_id, title, status, visibility, neighborhood, primary_line) values
       ($1, $4, $5, 'published', 'public', $6, 'rl'),
       ($2, $4, $5, 'published', 'friends', $7, 'gl'),
       ($3, $4, $5, 'published', 'public', $6, 'ol')`,
    [trail.open, trail.friendsOnly, trail.unfinished, id.creator, `${tag} trail`, hood.open, hood.friendsOnly],
  )
  // Recent activity by two people on both finished trails, so both trend.
  for (const actor of [id.actor1, id.actor2]) {
    for (const t of [trail.open, trail.friendsOnly]) {
      await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed')`, [actor, t])
    }
  }
  // The friend finished both trails and is midway through the third.
  await sql(
    `insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed'), ($1, $3, 'completed'), ($1, $4, 'in_progress')`,
    [id.friend, trail.open, trail.friendsOnly, trail.unfinished],
  )
  await sql('commit')
  const clients = new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey }))
  explore = new ExploreService(clients)
  communities = new CommunitiesService(clients)
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
  await db.end()
})

describe('trending', () => {
  it.each(['creator', 'friend', 'stranger'] as const)('for the %s, equals trending_trails() with the same token', async (p) => {
    const { data, error } = await direct(users[p]).rpc('trending_trails', { p_days: 14, p_limit: 100 })
    expect(error).toBeNull()
    const expected = (data as { sidequest_id: string; score: number; people: number }[]).map((r) => ({
      trailId: r.sidequest_id,
      score: r.score,
      people: r.people,
    }))
    expect(await explore.trending({ days: 14, limit: 100 }, users[p])).toEqual(expected)
  })

  it('shows a friends-only trail only to people who can see it', async () => {
    const ids = async (p: Person) => (await explore.trending({ limit: 100 }, users[p])).map((t) => t.trailId)
    expect(await ids('friend')).toEqual(expect.arrayContaining([trail.open, trail.friendsOnly]))
    expect(await ids('stranger')).toContain(trail.open)
    expect(await ids('stranger')).not.toContain(trail.friendsOnly)
  })

  it('counts people, not rows, and uses the web defaults when the query is empty', async () => {
    const entry = (await explore.trending({ limit: 100 }, users.friend)).find((t) => t.trailId === trail.friendsOnly)
    expect(entry?.people).toBe(3)
    const { data } = await direct(users.friend).rpc('trending_trails', { p_days: 14, p_limit: 30 })
    expect((await explore.trending({}, users.friend)).length).toBe((data as unknown[]).length)
  })
})

describe('neighborhoods', () => {
  it.each([null, 'friend', 'stranger'] as const)('for %s, equals the web query with the same token', async (p) => {
    const user = p ? users[p] : null
    const { data } = await direct(user).from('sidequests').select('neighborhood').eq('status', 'published').not('neighborhood', 'is', null)
    const expected = [...new Set((data ?? []).map((r) => r.neighborhood?.trim()).filter(Boolean))].sort((a, b) => a!.localeCompare(b!))
    expect(await explore.neighborhoods(user)).toEqual(expected)
  })

  it('lists a friends-only trail’s neighborhood only for friends, once', async () => {
    const friend = await explore.neighborhoods(users.friend)
    expect(friend.filter((n) => n === hood.open)).toHaveLength(1)
    expect(friend).toContain(hood.friendsOnly)
    expect(await explore.neighborhoods(users.stranger)).not.toContain(hood.friendsOnly)
    expect(await explore.neighborhoods(null)).not.toContain(hood.friendsOnly)
  })
})

describe('finished trails (badges)', () => {
  it('lists only your own finished trails, with line and neighborhood', async () => {
    const trails = await explore.finishedTrails(users.friend)
    expect(trails.map(({ line, neighborhood }) => ({ line, neighborhood })).sort((a, b) => a.line!.localeCompare(b.line!))).toEqual([
      { line: 'gl', neighborhood: hood.friendsOnly },
      { line: 'rl', neighborhood: hood.open },
    ])
    expect(trails.every((t) => typeof t.completedAt === 'string')).toBe(true)
    expect(await explore.finishedTrails(users.stranger)).toEqual([])
  })

  it('a finished trail hidden from you since still counts, without line or neighborhood', async () => {
    await sql(`delete from public.follows where follower_id = $1 and following_id = $2`, [id.creator, id.friend])
    try {
      const trails = await explore.finishedTrails(users.friend)
      expect(trails).toHaveLength(2)
      expect(trails).toContainEqual(expect.objectContaining({ line: null, neighborhood: null }))
    } finally {
      await sql(`insert into public.follows (follower_id, following_id) values ($1, $2)`, [id.creator, id.friend])
    }
  })
})

describe('communities', () => {
  it('lists the same communities as the web query', async () => {
    const { data } = await direct(null).from('communities').select('id, name, slug').order('name')
    expect(await communities.list(null)).toEqual((data ?? []).filter((c) => c.slug !== null))
  })

  it('joining and leaving changes only your own profile', async () => {
    const [first] = await communities.list(users.stranger)
    expect(first).toBeDefined()
    const read = async (p: Person) =>
      (await sql(`select community_id from public.profiles where id = $1`, [id[p]])).rows[0].community_id as string | null
    expect(await communities.setMine(first!.id, users.stranger)).toBe(first!.id)
    expect(await read('stranger')).toBe(first!.id)
    expect(await read('friend')).toBeNull()
    expect(await communities.setMine(null, users.stranger)).toBeNull()
    expect(await read('stranger')).toBeNull()
  })

  it('an unknown community is a 422 and changes nothing', async () => {
    await expect(communities.setMine(randomUUID(), users.stranger)).rejects.toBeInstanceOf(UnprocessableEntityException)
    expect((await sql(`select community_id from public.profiles where id = $1`, [id.stranger])).rows[0].community_id).toBeNull()
  })
})
