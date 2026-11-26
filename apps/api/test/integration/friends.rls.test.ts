/**
 * Follows, friends, close friends and private accounts against a real local Supabase.
 * Counts and lists equal what Supabase returns for the same token (signed in or out);
 * relationships and the friends list follow mutual follows; follow / unfollow and
 * close-friend changes are repeatable and only ever touch the caller's own rows;
 * following yourself is 422, an unknown person 404, a non-friend as close friend 403
 * with nothing stored; going private hides your trails from non-friends.
 * Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { FriendsService } from '../../src/friends/friends.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

/** me ⇄ friend (mutual), fan → me, me → idol, stranger: nothing. */
const PEOPLE = ['me', 'friend', 'fan', 'idol', 'stranger'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const myTrail = randomUUID()

let local: LocalSupabase
let db: pg.Client
let service: FriendsService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)

function direct(user: AuthUser | null) {
  return createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: user ? { headers: { Authorization: `Bearer ${user.accessToken}` } } : undefined,
  })
}

const follows = async (from: Person, to: Person) =>
  (await sql(`select 1 from public.follows where follower_id = $1 and following_id = $2`, [id[from], id[to]])).rowCount === 1
const closeIds = async (owner: Person) =>
  (await sql(`select friend_id from public.close_friends where owner_id = $1`, [id[owner]])).rows.map((r) => r.friend_id as string)
const follow = (from: Person, to: Person) =>
  sql(`insert into public.follows (follower_id, following_id) values ($1, $2) on conflict do nothing`, [id[from], id[to]])

beforeAll(async () => {
  local = localSupabase()
  db = new pg.Client({ connectionString: local.dbUrl })
  await db.connect()
  await sql('begin')
  for (const [i, p] of PEOPLE.entries()) {
    await sql(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now() + make_interval(secs => $3), now())`,
      [id[p], `rls-${tag}-${p}@example.test`, i],
    )
    await sql(`update public.profiles set display_name = $2 where id = $1`, [id[p], `${tag} ${p}`])
  }
  await sql('commit')
  // Separate statements so created_at differs and "newest first" is testable.
  await follow('me', 'friend')
  await follow('friend', 'me')
  await follow('fan', 'me')
  await follow('me', 'idol')
  await sql(`insert into public.sidequests (id, creator_id, title, status, visibility) values ($1, $2, $3, 'published', 'public')`, [
    myTrail,
    id.me,
    `${tag} my trail`,
  ])
  service = new FriendsService(new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })))
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

describe('anyone’s follows (public)', () => {
  it.each([null, 'me', 'stranger'] as const)('counts and lists for %s equal the web queries', async (viewer) => {
    const user = viewer ? users[viewer] : null
    const d = direct(user)
    const count = async (column: 'follower_id' | 'following_id') =>
      (await d.from('follows').select('follower_id', { count: 'exact', head: true }).eq(column, id.me)).count
    expect(await service.followCounts(id.me, user)).toEqual({ followers: await count('following_id'), following: await count('follower_id') })
    expect(await service.followCounts(id.me, user)).toEqual({ followers: 2, following: 2 })

    const { data } = await d
      .from('follows')
      .select('created_at, person:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)')
      .eq('following_id', id.me)
      .order('created_at', { ascending: false })
      .limit(500)
    expect(await service.followList(id.me, 'followers', user)).toEqual((data ?? []).map((r) => r.person))
  })

  it('lists newest first in both directions', async () => {
    expect((await service.followList(id.me, 'followers', null)).map((p) => p.id)).toEqual([id.fan, id.friend])
    expect((await service.followList(id.me, 'following', null)).map((p) => p.id)).toEqual([id.idol, id.friend])
  })
})

describe('the caller’s connections', () => {
  it('following ids and relationships', async () => {
    expect((await service.followingIds(users.me)).sort()).toEqual([id.friend, id.idol].sort())
    expect(await service.relationship(id.friend, users.me)).toEqual({ following: true, followsYou: true })
    expect(await service.relationship(id.fan, users.me)).toEqual({ following: false, followsYou: true })
    expect(await service.relationship(id.idol, users.me)).toEqual({ following: true, followsYou: false })
    expect(await service.relationship(id.stranger, users.me)).toEqual({ following: false, followsYou: false })
  })

  it('friends are mutual follows only, A to Z', async () => {
    expect((await service.friends(users.me)).map((p) => p.id)).toEqual([id.friend])
    expect(await service.friends(users.stranger)).toEqual([])
  })

  it('follow and unfollow are repeatable and touch only the caller’s own rows', async () => {
    expect(await service.setFollowing(id.idol, true, users.stranger)).toBe(true)
    expect(await service.setFollowing(id.idol, true, users.stranger)).toBe(true)
    expect(await follows('stranger', 'idol')).toBe(true)
    expect(await service.setFollowing(id.idol, false, users.stranger)).toBe(false)
    expect(await service.setFollowing(id.idol, false, users.stranger)).toBe(false)
    expect(await follows('stranger', 'idol')).toBe(false)
    expect(await follows('me', 'idol')).toBe(true)
  })

  it('following yourself is 422; an unknown person is 404', async () => {
    await expect(service.setFollowing(id.me, true, users.me)).rejects.toBeInstanceOf(UnprocessableEntityException)
    await expect(service.setFollowing(randomUUID(), true, users.me)).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('close friends', () => {
  it('friends can be added (repeatably) and removed; the list is private', async () => {
    expect(await service.setCloseFriend(id.friend, true, users.me)).toBe(true)
    expect(await service.setCloseFriend(id.friend, true, users.me)).toBe(true)
    expect(await service.closeFriendIds(users.me)).toEqual([id.friend])
    expect(await service.closeFriendIds(users.friend)).toEqual([])
    expect(await service.setCloseFriend(id.friend, false, users.me)).toBe(false)
    expect(await closeIds('me')).toEqual([])
  })

  it.each(['fan', 'idol', 'stranger'] as const)('a %s (not a mutual follow) is 403 and nothing is stored', async (p) => {
    await expect(service.setCloseFriend(id[p], true, users.me)).rejects.toBeInstanceOf(ForbiddenException)
    expect(await closeIds('me')).toEqual([])
  })
})

describe('private account', () => {
  it('hides your trails from non-friends only, and changes only your profile', async () => {
    const sees = async (viewer: Person) => ((await direct(users[viewer]).from('sidequests').select('id').eq('id', myTrail)).data ?? []).length === 1
    expect(await service.setPrivate(true, users.me)).toBe(true)
    try {
      expect(await sees('stranger')).toBe(false)
      expect(await sees('fan')).toBe(false)
      expect(await sees('friend')).toBe(true)
      expect((await sql(`select is_private from public.profiles where id = $1`, [id.friend])).rows[0].is_private).toBe(false)
    } finally {
      expect(await service.setPrivate(false, users.me)).toBe(false)
    }
    expect(await sees('stranger')).toBe(true)
  })
})
