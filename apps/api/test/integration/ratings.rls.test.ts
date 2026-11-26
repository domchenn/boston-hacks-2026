/**
 * Ratings against a real local Supabase: only a finished trail can be rated (422
 * otherwise, nothing stored), never your own (403), rating again edits the one row,
 * a blank review is stored as none, deleting works and is repeatable, and one user's
 * calls never read or remove another user's rating. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { UserSidequestStatus } from '@breadcrumb/contracts'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { RatingsService } from '../../src/ratings/ratings.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['user', 'other', 'creator'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
/** A public trail made by the creator. */
const trail = randomUUID()
const BODY = { price: 4, time: 3, enjoyment: 5, memorability: 2, review: '  Lovely walk  ' }

let local: LocalSupabase
let db: pg.Client
let service: RatingsService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)

async function setStatus(person: Person, status: UserSidequestStatus | null) {
  await sql(`delete from public.user_sidequests where user_id = $1 and sidequest_id = $2`, [id[person], trail])
  if (status) {
    await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, $3)`, [id[person], trail, status])
  }
}

async function storedRows(person: Person) {
  const { rows } = await sql(
    `select id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text
       from public.sidequest_ratings where user_id = $1 and sidequest_id = $2`,
    [id[person], trail],
  )
  return rows
}

const clearRatings = () => sql(`delete from public.sidequest_ratings where sidequest_id = $1`, [trail])

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
  await sql(`insert into public.sidequests (id, creator_id, title, status, visibility) values ($1, $2, $3, 'published', 'public')`, [
    trail,
    id.creator,
    `${tag} trail`,
  ])
  await sql('commit')
  service = new RatingsService(new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })))
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
  await sql(`delete from public.sidequests where id = $1`, [trail])
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('who can rate', () => {
  it.each([null, 'saved', 'signed_up', 'in_progress', 'aborted'] as const)(
    'a trail you have not finished (%s) is a 422 and stores nothing',
    async (status) => {
      await clearRatings()
      // signed_up needs a scheduled trail; give it one for that case only.
      await sql(`update public.sidequests set scheduled_at = $2 where id = $1`, [trail, status === 'signed_up' ? new Date(Date.now() + 7 * 864e5) : null])
      await setStatus('user', status)
      await expect(service.rate(trail, BODY, users.user)).rejects.toBeInstanceOf(UnprocessableEntityException)
      expect(await storedRows('user')).toEqual([])
    },
  )

  it('your own trail is a 403 even after finishing it, and stores nothing', async () => {
    await clearRatings()
    await setStatus('creator', 'completed')
    await expect(service.rate(trail, BODY, users.creator)).rejects.toBeInstanceOf(ForbiddenException)
    expect(await storedRows('creator')).toEqual([])
  })
})

describe('rating a finished trail', () => {
  it('stores exactly the scores, trims the review and answers with what was stored', async () => {
    await clearRatings()
    await setStatus('user', 'completed')
    const rating = await service.rate(trail, BODY, users.user)
    const [row] = await storedRows('user')
    expect(row).toEqual({ id: rating!.id, price_rating: 4, time_rating: 3, enjoyment_rating: 5, memorability_rating: 2, review_text: 'Lovely walk' })
    expect(rating).toMatchObject({ price: 4, time: 3, enjoyment: 5, memorability: 2, review: 'Lovely walk' })
    expect(await service.get(trail, users.user)).toEqual(rating)
  })

  it('rating again edits the same row; a blank review becomes none', async () => {
    await clearRatings()
    await setStatus('user', 'completed')
    const first = await service.rate(trail, BODY, users.user)
    const second = await service.rate(trail, { price: 1, time: 1, enjoyment: 2, memorability: 3, review: '   ' }, users.user)
    expect(second).toMatchObject({ id: first!.id, price: 1, time: 1, enjoyment: 2, memorability: 3, review: null })
    expect(await storedRows('user')).toHaveLength(1)
  })

  it('deleting removes it, and deleting again is fine', async () => {
    await clearRatings()
    await setStatus('user', 'completed')
    await service.rate(trail, BODY, users.user)
    await service.remove(trail, users.user)
    expect(await service.get(trail, users.user)).toBeNull()
    await expect(service.remove(trail, users.user)).resolves.toBeUndefined()
  })

  it("one user's calls never read or remove another user's rating", async () => {
    await clearRatings()
    await setStatus('user', 'completed')
    await service.rate(trail, BODY, users.user)
    expect(await service.get(trail, users.other)).toBeNull()
    await service.remove(trail, users.other)
    expect(await storedRows('user')).toHaveLength(1)
  })
})
