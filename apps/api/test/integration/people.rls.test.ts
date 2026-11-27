/**
 * Friends' activity, "also saved", trail cards, people search and suggestions against
 * a real local Supabase. Activity and "also saved" equal what the database functions
 * return for the same token, minus trails the caller can't see; cards leave hidden
 * trails out and carry ratings; search never returns you and survives filter
 * characters; suggestions put people who follow you first and leave out you and
 * people you follow. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { PeopleService } from '../../src/friends/people.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

/** me ⇄ friend (mutual); me → idol (one way); fan → me (one way); stranger: nothing. */
const PEOPLE = ['me', 'friend', 'idol', 'fan', 'stranger'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().replace(/-/g, '').slice(0, 6)
const trail = {
  /** By the stranger, public, two stops; finished and rated by the friend, saved by me, friend and idol. */
  walk: randomUUID(),
  /** By the friend, public: "made" activity. */
  friendsOwn: randomUUID(),
  /** By the friend, close friends only (I'm not on the list): hidden from me. */
  secret: randomUUID(),
}

let local: LocalSupabase
let db: pg.Client
let service: PeopleService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)

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
    await sql(`update public.profiles set username = $2, display_name = $3 where id = $1`, [id[p], `rls_${tag}_${p}`, `Tester ${tag} ${p}`])
  }
  await sql(
    `insert into public.follows (follower_id, following_id) values ($1, $2), ($2, $1), ($1, $3), ($4, $1)`,
    [id.me, id.friend, id.idol, id.fan],
  )
  await sql(
    `insert into public.sidequests (id, creator_id, title, status, visibility) values
       ($1, $4, $5 || ' walk', 'published', 'public'),
       ($2, $6, $5 || ' friends own', 'published', 'public'),
       ($3, $6, $5 || ' secret', 'published', 'close_friends')`,
    [trail.walk, trail.friendsOwn, trail.secret, id.stranger, tag, id.friend],
  )
  await sql(
    `insert into public.sidequest_stops (sidequest_id, place_name, stop_order) values ($1, 'First stop', 0), ($1, 'Last stop', 1)`,
    [trail.walk],
  )
  await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed')`, [id.friend, trail.walk])
  await sql(
    `insert into public.sidequest_ratings (user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating)
     values ($1, $2, 4, 4, 4, 4)`,
    [id.friend, trail.walk],
  )
  await sql('commit')
  // Saves of a second trail: me, friend (mutual) and idol (one way) all saved the friend's own trail.
  for (const p of ['me', 'friend', 'idol'] as const) {
    await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'saved')`, [id[p], trail.friendsOwn])
  }
  service = new PeopleService(new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })))
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

describe('trail cards', () => {
  it('match the web’s card for a visible trail, with stops and rating', async () => {
    const [card] = await service.cards([trail.walk], null)
    expect(card).toMatchObject({
      id: trail.walk,
      title: `${tag} walk`,
      stopCount: 2,
      firstStopName: 'First stop',
      lastStopName: 'Last stop',
      rating: { average: 4, count: 1 },
      creator: { username: `rls_${tag}_stranger` },
    })
  })

  it('leave out trails hidden from the caller, keep the order given and skip repeats', async () => {
    const ids = (cards: { id: string }[]) => cards.map((c) => c.id)
    expect(ids(await service.cards([trail.secret, trail.friendsOwn, trail.walk, trail.walk], users.me))).toEqual([trail.friendsOwn, trail.walk])
    expect(ids(await service.cards([trail.secret], users.friend))).toEqual([trail.secret])
    expect(await service.cards([randomUUID()], users.me)).toEqual([])
  })
})

describe('friends’ activity', () => {
  it('equals friends_activity() for the same token, minus trails you can’t see', async () => {
    const { data } = await direct(users.me).rpc('friends_activity', { p_limit: 100 })
    const rows = (data as { sidequest_id: string; kind: string; user_id: string; happened_at: string }[]).filter((r) => r.kind !== 'joined')
    const visible = new Set((await direct(users.me).from('sidequests').select('id').in('id', rows.map((r) => r.sidequest_id))).data!.map((r) => r.id))
    const activity = await service.activity(100, users.me)
    expect(activity.items.map((i) => [i.person.id, i.kind, i.trailId, i.at])).toEqual(
      rows.filter((r) => visible.has(r.sidequest_id)).map((r) => [r.user_id, r.kind, r.sidequest_id, r.happened_at]),
    )
    expect(new Set(activity.trails.map((t) => t.id))).toEqual(new Set(activity.items.map((i) => i.trailId)))
  })

  it('shows what my friend made and finished, never their close-friends-only trail', async () => {
    const items = (await service.activity(100, users.me)).items.filter((i) => i.person.id === id.friend)
    expect(items.map((i) => [i.kind, i.trailId]).sort()).toEqual(
      [
        ['finished', trail.walk],
        ['made', trail.friendsOwn],
      ].sort(),
    )
  })

  it('is empty for someone who follows nobody', async () => {
    expect(await service.activity(30, users.stranger)).toEqual({ items: [], trails: [] })
  })
})

describe('also saved', () => {
  it('equals friends_also_saved() and lists only friends (mutual follows)', async () => {
    const { data } = await direct(users.me).rpc('friends_also_saved')
    const saves = await service.alsoSaved(users.me)
    expect(saves.map((s) => [s.trailId, s.friend.id])).toEqual((data as { sidequest_id: string; friend_id: string }[]).map((r) => [r.sidequest_id, r.friend_id]))
    expect(saves.filter((s) => s.trailId === trail.friendsOwn).map((s) => s.friend.id)).toEqual([id.friend])
  })
})

describe('finding people', () => {
  it('search matches username or name, never returns you, and respects the limit', async () => {
    const found = (await service.search(tag, 20, users.me)).map((p) => p.id)
    expect(found.sort()).toEqual([id.friend, id.idol, id.fan, id.stranger].sort())
    expect(await service.search(`@rls_${tag}_fan`, 8, users.me)).toEqual([
      { id: id.fan, username: `rls_${tag}_fan`, display_name: `Tester ${tag} fan`, avatar_url: null },
    ])
    expect(await service.search(tag, 2, users.me)).toHaveLength(2)
  })

  it.each(['a', '  ', '%,)(', `${tag}%,or(id.neq.x)`])('search survives short or filter-breaking input (%s)', async (q) => {
    await expect(service.search(q, 8, users.me)).resolves.toBeInstanceOf(Array)
  })

  it('suggestions put people who follow you first and leave out you and people you follow', async () => {
    const suggested = (await service.suggestions(20, users.me)).map((p) => p.id)
    expect(suggested[0]).toBe(id.fan)
    expect(suggested).not.toContain(id.me)
    expect(suggested).not.toContain(id.friend)
    expect(suggested).not.toContain(id.idol)
    expect(suggested).toContain(id.stranger)
    expect(await service.suggestions(1, users.me)).toHaveLength(1)
  })
})
