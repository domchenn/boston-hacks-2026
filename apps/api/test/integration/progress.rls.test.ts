/**
 * Progress against a real local Supabase: every starting status gives exactly the
 * web's transition table for save, unsave, start, finish and abort; started trails
 * keep their history; a finished trail never moves; a trail hidden by RLS can't be
 * saved or started (404); crumbs can be ticked only while the trail is in progress
 * (403 otherwise), stopping keeps earlier ticks and resuming continues with them; and
 * one user's actions never touch another user's rows. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { UserSidequestStatus } from '@breadcrumb/contracts'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { ProgressService } from '../../src/progress/progress.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['user', 'other', 'creator'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
/** A public trail with a start time, so every status (including signed_up) is allowed. */
const trail = randomUUID()
/** Friends-only trail by the creator, who is not the user's friend: hidden from the user. */
const hidden = randomUUID()
const crumb = randomUUID()

let local: LocalSupabase
let db: pg.Client
let service: ProgressService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)

type State = { status: UserSidequestStatus; started: boolean } | null

async function setState(person: Person, state: State) {
  await sql(`delete from public.user_sidequests where user_id = $1 and sidequest_id = $2`, [id[person], trail])
  if (!state) return
  await sql(
    `insert into public.user_sidequests (user_id, sidequest_id, status, started_at) values ($1, $2, $3, $4)`,
    [id[person], trail, state.status, state.started ? new Date(Date.now() - 3600e3).toISOString() : null],
  )
}

async function getState(person: Person) {
  const { rows } = await sql(
    `select status, started_at, completed_at from public.user_sidequests where user_id = $1 and sidequest_id = $2`,
    [id[person], trail],
  )
  return rows[0] as { status: UserSidequestStatus; started_at: Date | null; completed_at: Date | null } | undefined
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
  await sql(
    `insert into public.sidequests (id, creator_id, title, status, visibility, scheduled_at)
     values ($1, $3, $4, 'published', 'public', now() + interval '7 days'), ($2, $3, $5, 'published', 'friends', null)`,
    [trail, hidden, id.creator, `${tag} trail`, `${tag} hidden`],
  )
  await sql(`insert into public.checklist_items (id, sidequest_id, label, item_type, item_order) values ($1, $2, 'Look up', 'see', 0)`, [crumb, trail])
  await sql('commit')
  service = new ProgressService(
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
  await db.end()
})

// [starting state, status after save, status after unsave] — the web's table.
const TABLE: [string, State, UserSidequestStatus | null, UserSidequestStatus | null][] = [
  ['no row', null, 'saved', null],
  ['saved (never started)', { status: 'saved', started: false }, 'saved', null],
  ['saved (paused mid-trail)', { status: 'saved', started: true }, 'saved', 'aborted'],
  ['signed_up', { status: 'signed_up', started: false }, 'signed_up', 'signed_up'],
  ['in_progress', { status: 'in_progress', started: true }, 'saved', 'in_progress'],
  ['completed', { status: 'completed', started: true }, 'completed', 'completed'],
  ['aborted', { status: 'aborted', started: true }, 'saved', 'aborted'],
]

describe.each(TABLE)('from %s', (_label, start, afterSave, afterUnsave) => {
  it(`save → ${afterSave}`, async () => {
    await setState('user', start)
    expect(await service.save(trail, users.user)).toEqual({ status: afterSave })
    expect((await getState('user'))?.status ?? null).toBe(afterSave)
  })

  it(`unsave → ${afterUnsave ?? 'no row'}`, async () => {
    await setState('user', start)
    expect(await service.unsave(trail, users.user)).toEqual({ status: afterUnsave })
    expect((await getState('user'))?.status ?? null).toBe(afterUnsave)
  })
})

describe('history and safety', () => {
  it('unsaving a paused trail keeps when it was started', async () => {
    await setState('user', { status: 'saved', started: true })
    const before = (await getState('user'))!.started_at
    await service.unsave(trail, users.user)
    expect((await getState('user'))!.started_at).toEqual(before)
  })

  it('a finished trail keeps its completion time when saved again', async () => {
    await setState('user', { status: 'completed', started: true })
    const before = (await getState('user'))!.completed_at
    await service.save(trail, users.user)
    expect((await getState('user'))!.completed_at).toEqual(before)
  })

  it('saving a trail hidden from you is a 404 and writes nothing', async () => {
    await expect(service.save(hidden, users.user)).rejects.toBeInstanceOf(NotFoundException)
    const { rowCount } = await sql(`select 1 from public.user_sidequests where user_id = $1 and sidequest_id = $2`, [id.user, hidden])
    expect(rowCount).toBe(0)
  })

  it('saving a trail that does not exist is a 404', async () => {
    await expect(service.save(randomUUID(), users.user)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("one user's save and unsave never touch another user's row", async () => {
    await setState('other', { status: 'saved', started: false })
    await setState('user', null)
    await service.save(trail, users.user)
    await service.unsave(trail, users.user)
    expect((await getState('other'))?.status).toBe('saved')
    expect((await getState('user'))?.status ?? null).toBeNull()
  })
})

// [starting state, after start, after finish, after abort] — the web's table.
const ACTIONS_TABLE: [string, State, UserSidequestStatus | null, UserSidequestStatus | null, UserSidequestStatus | null][] = [
  ['no row', null, 'in_progress', 'completed', null],
  ['saved', { status: 'saved', started: false }, 'in_progress', 'completed', 'aborted'],
  ['signed_up', { status: 'signed_up', started: false }, 'in_progress', 'completed', 'aborted'],
  ['in_progress', { status: 'in_progress', started: true }, 'in_progress', 'completed', 'aborted'],
  ['completed', { status: 'completed', started: true }, 'completed', 'completed', 'completed'],
  ['aborted', { status: 'aborted', started: true }, 'in_progress', 'completed', 'aborted'],
]

describe.each(ACTIONS_TABLE)('actions from %s', (_label, start, afterStart, afterFinish, afterAbort) => {
  it.each([
    ['start', afterStart],
    ['finish', afterFinish],
    ['abort', afterAbort],
  ] as const)('%s → %s', async (action, expected) => {
    await setState('user', start)
    expect(await service.act(trail, action, users.user)).toEqual({ status: expected })
    expect((await getState('user'))?.status ?? null).toBe(expected)
    expect(await service.status(trail, users.user)).toEqual({ status: expected })
  })
})

describe('actions and crumbs: safety', () => {
  it('finishing sets completed_at; starting sets started_at', async () => {
    await setState('user', null)
    await service.act(trail, 'start', users.user)
    expect((await getState('user'))!.started_at).not.toBeNull()
    await service.act(trail, 'finish', users.user)
    expect((await getState('user'))!.completed_at).not.toBeNull()
  })

  it('starting a trail hidden from you is a 404 and writes nothing', async () => {
    await expect(service.act(hidden, 'start', users.user)).rejects.toBeInstanceOf(NotFoundException)
    const { rowCount } = await sql(`select 1 from public.user_sidequests where user_id = $1 and sidequest_id = $2`, [id.user, hidden])
    expect(rowCount).toBe(0)
  })

  it('a crumb can be ticked only while the trail is in progress, and ticking twice is fine', async () => {
    await sql(`delete from public.checklist_completions where checklist_item_id = $1`, [crumb])
    for (const state of [null, { status: 'saved', started: false }, { status: 'completed', started: true }] as State[]) {
      await setState('user', state)
      await expect(service.setCrumb(crumb, true, users.user)).rejects.toBeInstanceOf(ForbiddenException)
    }
    await setState('user', { status: 'in_progress', started: true })
    await expect(service.setCrumb(crumb, true, users.user)).resolves.toEqual({ done: true })
    await expect(service.setCrumb(crumb, true, users.user)).resolves.toEqual({ done: true })
    expect(await service.tickedCrumbs(trail, users.user)).toEqual([crumb])
    await expect(service.setCrumb(crumb, false, users.user)).resolves.toEqual({ done: false })
    expect(await service.tickedCrumbs(trail, users.user)).toEqual([])
  })

  it('stopping keeps earlier ticks and refuses new ones; resuming continues with them', async () => {
    await sql(`delete from public.checklist_completions where checklist_item_id = $1`, [crumb])
    await setState('user', { status: 'in_progress', started: true })
    await service.setCrumb(crumb, true, users.user)
    await service.act(trail, 'abort', users.user)
    expect(await service.tickedCrumbs(trail, users.user)).toEqual([crumb])
    await service.act(trail, 'start', users.user)
    expect(await service.tickedCrumbs(trail, users.user)).toEqual([crumb])
    await service.act(trail, 'abort', users.user)
    await expect(service.setCrumb(crumb, false, users.user)).resolves.toEqual({ done: false })
    await expect(service.setCrumb(crumb, true, users.user)).rejects.toBeInstanceOf(ForbiddenException)
    await service.act(trail, 'start', users.user)
    await expect(service.setCrumb(crumb, true, users.user)).resolves.toEqual({ done: true })
  })

  it("ticks are private: another user neither sees nor removes them", async () => {
    await sql(`delete from public.checklist_completions where checklist_item_id = $1`, [crumb])
    await setState('user', { status: 'in_progress', started: true })
    await service.setCrumb(crumb, true, users.user)
    expect(await service.tickedCrumbs(trail, users.other)).toEqual([])
    await service.setCrumb(crumb, false, users.other)
    expect(await service.tickedCrumbs(trail, users.user)).toEqual([crumb])
  })
})
