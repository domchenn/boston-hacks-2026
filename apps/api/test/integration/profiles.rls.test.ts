/**
 * RLS equivalence for profiles and personal lists, against a real local Supabase.
 *
 * Fixtures: an owner who made trails of every kind (published, draft, friends-only,
 * archived) and has progress on another creator's trails (saved, in progress,
 * finished and rated, signed up), plus a friend and a stranger. Checks that each
 * viewer gets exactly what Supabase returns for the same token, that private
 * progress never reaches anyone else, and that every response fits the contract.
 * Throwaway data with random ids, deleted afterwards; localhost only.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { ProfileStats, ProfileTrailList, PublicProfile, SavedTrailList } from '@breadcrumb/contracts'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { ProfilesService } from '../../src/profiles/profiles.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['owner', 'friend', 'stranger', 'creator'] as const
type Person = (typeof PEOPLE)[number]
type Viewer = Person | 'anon'
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const username = (p: Person) => `rls_${tag}_${p}`.slice(0, 30)

const made = { published: randomUUID(), draft: randomUUID(), friends: randomUUID(), archived: randomUUID() }
const other = { saved: randomUUID(), inProgress: randomUUID(), finished: randomUUID(), signedUp: randomUUID() }

let local: LocalSupabase
let db: pg.Client
let service: ProfilesService
const users = {} as Record<Viewer, AuthUser | null>

const sql = (text: string, values: unknown[] = []) => db.query(text, values)

beforeAll(async () => {
  local = localSupabase()
  db = new pg.Client({ connectionString: local.dbUrl })
  await db.connect()
  await sql('begin')
  for (const p of PEOPLE) {
    await sql(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', $3, now(), now())`,
      [id[p], `${username(p)}@example.test`, JSON.stringify({ display_name: `${tag} ${p}` })],
    )
    await sql(`update public.profiles set username = $2, bio = $3 where id = $1`, [id[p], username(p), `bio of ${p}`])
  }
  await sql(`insert into public.follows (follower_id, following_id) values ($1, $2), ($2, $1)`, [id.owner, id.friend])

  const trail = (tid: string, creator: string, status: string, visibility = 'public', scheduled: string | null = null) =>
    sql(
      `insert into public.sidequests (id, creator_id, title, status, visibility, scheduled_at, category, estimated_cost, estimated_duration_minutes)
       values ($1, $2, $3, $4, $5, $6, 'arts_culture', 9.5, 60)`,
      [tid, creator, `${tag} ${status} ${visibility}`, status, visibility, scheduled],
    )
  await trail(made.published, id.owner, 'published')
  await trail(made.draft, id.owner, 'draft')
  await trail(made.friends, id.owner, 'published', 'friends')
  await trail(made.archived, id.owner, 'archived')
  await trail(other.saved, id.creator, 'published')
  await trail(other.inProgress, id.creator, 'published')
  await trail(other.finished, id.creator, 'published')
  await trail(other.signedUp, id.creator, 'published', 'public', new Date(Date.now() + 7 * 864e5).toISOString())
  await sql(`insert into public.sidequest_stops (sidequest_id, stop_order, place_name) values ($1, 0, 'First'), ($1, 1, 'Last')`, [other.saved])

  const progress = (trailId: string, status: string) =>
    sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, $3)`, [id.owner, trailId, status])
  await progress(other.saved, 'saved')
  await progress(other.inProgress, 'in_progress')
  await progress(other.finished, 'completed')
  await progress(other.signedUp, 'signed_up')
  await sql(
    `insert into public.sidequest_ratings (user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating)
     values ($1, $2, 5, 4, 4, 3)`,
    [id.owner, other.finished],
  )
  await sql('commit')

  service = new ProfilesService(
    new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })),
  )
  users.anon = null
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

function direct(user: AuthUser | null) {
  return createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: user ? { headers: { Authorization: `Bearer ${user.accessToken}` } } : undefined,
  })
}

const viewers = ['anon', 'owner', 'friend', 'stranger'] as const
const sorted = (ids: string[]) => [...ids].sort()

describe('profiles are public', () => {
  it.each(viewers)('%s finds the owner by id and by username', async (viewer) => {
    const byId = await service.getProfile(id.owner, users[viewer])
    const byName = await service.getProfile(username('owner'), users[viewer])
    expect(byId).toEqual(byName)
    expect(PublicProfile.parse(byId)).toMatchObject({ id: id.owner, username: username('owner'), bio: 'bio of owner' })
  })

  it('an unknown handle is null', async () => {
    expect(await service.getProfile(randomUUID(), users.owner)).toBeNull()
    expect(await service.getProfile('nobody_by_this_name', users.owner)).toBeNull()
  })
})

describe.each(viewers)('viewer: %s', (viewer) => {
  it("made trails match Supabase and hide drafts, archived and (for non-friends) friends-only trails", async () => {
    const viaApi = await service.getMadeTrails(id.owner, users[viewer])
    const { data } = await direct(users[viewer]).from('sidequests').select('id').eq('creator_id', id.owner).neq('status', 'archived')
    expect(sorted(viaApi.map((t) => t.id))).toEqual(sorted((data ?? []).map((r) => r.id)))
    const expected = {
      anon: [made.published],
      owner: [made.published, made.draft, made.friends],
      friend: [made.published, made.friends],
      stranger: [made.published],
    }[viewer]
    expect(sorted(viaApi.map((t) => t.id))).toEqual(sorted(expected))
    expect(() => ProfileTrailList.parse({ trails: viaApi })).not.toThrow()
  })

  it("stats count what this viewer may see; finished count is the owner's alone", async () => {
    const stats = ProfileStats.parse(await service.getStats(id.owner, users[viewer]))
    expect(stats.madeCount).toBe({ anon: 1, owner: 3, friend: 2, stranger: 1 }[viewer])
    expect(stats.finishedCount).toBe(viewer === 'owner' ? 1 : null)
  })
})

describe('private progress', () => {
  it('the owner gets each tab, equal to Supabase, with their rating on finished trails', async () => {
    for (const status of ['completed', 'saved', 'signed_up'] as const) {
      const viaApi = await service.getMyTrails(status, users.owner!)
      const { data } = await direct(users.owner).from('user_sidequests').select('sidequest_id').eq('user_id', id.owner).eq('status', status)
      expect(sorted(viaApi.map((t) => t.id))).toEqual(sorted((data ?? []).map((r) => r.sidequest_id)))
      expect(() => ProfileTrailList.parse({ trails: viaApi })).not.toThrow()
    }
    const [finished] = await service.getMyTrails('completed', users.owner!)
    expect(finished).toMatchObject({ id: other.finished, myRating: 4, trailStatus: 'published' })
    expect(finished.completedAt).not.toBeNull()
  })

  it("the Saved page shows saved, in-progress and old signed-up trails, with cards filled in", async () => {
    const saved = SavedTrailList.parse({ trails: await service.getSavedTrails(users.owner!) }).trails
    expect(sorted(saved.map((t) => t.id))).toEqual(sorted([other.saved, other.inProgress, other.signedUp]))
    expect(saved.find((t) => t.id === other.inProgress)!.status).toBe('in_progress')
    expect(saved.find((t) => t.id === other.signedUp)!.status).toBe('saved')
    expect(saved.find((t) => t.id === other.saved)).toMatchObject({
      stopCount: 2,
      firstStopName: 'First',
      lastStopName: 'Last',
      creator: { username: username('creator') },
      estimatedCost: 9.5,
    })
  })

  it.each(['friend', 'stranger'] as const)("%s never sees the owner's progress", async (viewer) => {
    // The API only ever asks for the caller's own rows; even asking Supabase directly for the owner's returns nothing.
    expect(await service.getSavedTrails(users[viewer]!)).toEqual([])
    expect(await service.getMyTrails('completed', users[viewer]!)).toEqual([])
    const { data } = await direct(users[viewer]).from('user_sidequests').select('sidequest_id').eq('user_id', id.owner)
    expect(data).toEqual([])
  })

  it("the creator's questgiver rating reflects the owner's review", async () => {
    const stats = await service.getStats(id.creator, users.stranger)
    expect(stats.questgiverRating).toEqual({ average: 4, count: 1 })
    expect(stats.finishedCount).toBeNull()
  })
})
