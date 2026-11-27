/**
 * Reports and moderation against a real local Supabase, Storage included. Reporting is
 * as yourself and repeatable (one row). Non-moderators get 403 for the report list and
 * for resolving, and nothing changes. A moderator sees every open report with a
 * preview; "hide" archives a trail, deletes a review, or deletes a photo and its
 * file, and closes every open report on that item; "dismiss" leaves the item alone.
 * A handled report is 409; an unknown one 404. Throwaway data, localhost only.
 */
import { randomUUID } from 'node:crypto'
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { AuthUser } from '../../src/auth/auth-user.js'
import { loadConfig } from '../../src/config/env.js'
import { ModerationService } from '../../src/moderation/moderation.service.js'
import { SupabaseClients } from '../../src/supabase/supabase-clients.js'
import { localSupabase, userToken, type LocalSupabase } from './local-supabase.js'

const PEOPLE = ['creator', 'reporter', 'second', 'moderator'] as const
type Person = (typeof PEOPLE)[number]
const id = Object.fromEntries(PEOPLE.map((p) => [p, randomUUID()])) as Record<Person, string>
const tag = randomUUID().slice(0, 6)
const trail = { bad: randomUUID(), fine: randomUUID(), host: randomUUID() }
const review = randomUUID()
const photo = randomUUID()
/** A photo in the private `photos` bucket (photo privacy step 2), uploaded by the reporter. */
const privatePhoto = randomUUID()
const privatePath = `${trail.host}/${randomUUID()}.jpg`
const photoPath = `${id.creator}/trails/${trail.host}/${tag}.jpg`

let local: LocalSupabase
let db: pg.Client
let service: ModerationService
const users = {} as Record<Person, AuthUser>
const sql = (text: string, values: unknown[] = []) => db.query(text, values)
const reportsOn = async (targetId: string) =>
  (await sql(`select reporter_id, status, resolved_by, note from public.reports where target_id = $1 order by created_at`, [targetId])).rows
const fileExists = async (path: string, bucket = 'trail-photos') =>
  (await sql(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, path])).rowCount === 1

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
  await sql(`update public.profiles set is_admin = true, username = $2 where id = $1`, [id.moderator, `rls_${tag}_mod`])
  await sql(`update public.profiles set username = $2 where id = $1`, [id.reporter, `rls_${tag}_rep`])
  await sql(
    `insert into public.sidequests (id, creator_id, title, status) values ($1, $4, $5 || ' bad', 'published'), ($2, $4, $5 || ' fine', 'published'), ($3, $4, $5 || ' host', 'published')`,
    [trail.bad, trail.fine, trail.host, id.creator, tag],
  )
  await sql(`insert into public.user_sidequests (user_id, sidequest_id, status) values ($1, $2, 'completed')`, [id.reporter, trail.host])
  await sql(
    `insert into public.sidequest_ratings (id, user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text)
     values ($1, $2, $3, 1, 1, 1, 1, 'rude review')`,
    [review, id.reporter, trail.host],
  )
  await sql('commit')
  // A real stored photo by the creator, so hiding it can be checked end to end.
  const creatorToken = await userToken(local, id.creator)
  const storage = createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${creatorToken}` } },
  }).storage.from('trail-photos')
  const uploaded = await storage.upload(photoPath, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }))
  if (uploaded.error) throw uploaded.error
  await sql(`insert into public.quest_photos (id, user_id, sidequest_id, photo_url) values ($1, $2, $3, $4)`, [
    photo,
    id.creator,
    trail.host,
    storage.getPublicUrl(photoPath).data.publicUrl,
  ])

  const reporterStorage = createClient(local.url, local.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${await userToken(local, id.reporter)}` } },
  }).storage.from('photos')
  const privateUpload = await reporterStorage.upload(privatePath, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }))
  if (privateUpload.error) throw privateUpload.error
  await sql(`insert into public.quest_photos (id, user_id, sidequest_id, storage_path) values ($1, $2, $3, $4)`, [privatePhoto, id.reporter, trail.host, privatePath])

  service = new ModerationService(new SupabaseClients(loadConfig({ SUPABASE_URL: local.url, SUPABASE_PUBLISHABLE_KEY: local.publishableKey })))
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
  if (await fileExists(photoPath)) {
    await createClient(local.url, local.publishableKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${users.creator.accessToken}` } },
    })
      .storage.from('trail-photos')
      .remove([photoPath])
  }
  if (await fileExists(privatePath, 'photos')) {
    await createClient(local.url, local.publishableKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${users.reporter.accessToken}` } },
    })
      .storage.from('photos')
      .remove([privatePath])
  }
  await sql(`delete from public.reports where target_id = any($1)`, [[trail.bad, trail.fine, review, photo, privatePhoto]])
  await sql(`delete from auth.users where id = any($1)`, [Object.values(id)])
  await db.end()
})

describe('reporting', () => {
  it('reports as yourself; repeating is fine and stores one report; a blank note is none', async () => {
    expect(await service.report({ targetType: 'trail', targetId: trail.bad, reason: 'unsafe', note: '  ' }, users.reporter)).toEqual({ reported: true })
    expect(await service.report({ targetType: 'trail', targetId: trail.bad, reason: 'spam' }, users.reporter)).toEqual({ reported: true })
    expect(await service.report({ targetType: 'trail', targetId: trail.bad, reason: 'spam', note: 'Closed for good' }, users.second)).toEqual({ reported: true })
    expect(await reportsOn(trail.bad)).toEqual([
      { reporter_id: id.reporter, status: 'open', resolved_by: null, note: null },
      { reporter_id: id.second, status: 'open', resolved_by: null, note: 'Closed for good' },
    ])
    await service.report({ targetType: 'trail', targetId: trail.fine, reason: 'other' }, users.reporter)
    await service.report({ targetType: 'review', targetId: review, reason: 'inappropriate' }, users.second)
    await service.report({ targetType: 'photo', targetId: photo, reason: 'inappropriate' }, users.second)
    await service.report({ targetType: 'photo', targetId: privatePhoto, reason: 'inappropriate' }, users.second)
  })
})

describe('moderators only', () => {
  it('a non-moderator is told so (403) and changes nothing', async () => {
    expect(await service.isAdmin(users.reporter)).toBe(false)
    await expect(service.openReports(users.reporter)).rejects.toBeInstanceOf(ForbiddenException)
    const [anyReport] = (await sql(`select id from public.reports where target_id = $1`, [trail.bad])).rows
    await expect(service.resolve(anyReport.id, 'hide', users.creator)).rejects.toBeInstanceOf(ForbiddenException)
    expect((await sql(`select status from public.sidequests where id = $1`, [trail.bad])).rows[0].status).toBe('published')
    expect((await reportsOn(trail.bad)).every((r) => r.status === 'open')).toBe(true)
  })

  it('a moderator sees every open report with a preview', async () => {
    expect(await service.isAdmin(users.moderator)).toBe(true)
    const mine = (await service.openReports(users.moderator)).filter((r) => ([trail.bad, trail.fine, review, photo, privatePhoto] as string[]).includes(r.targetId))
    expect(mine).toHaveLength(6)
    expect(mine.find((r) => r.targetId === privatePhoto)?.preview?.imageUrl).toContain(`/object/sign/photos/${privatePath}`)
    expect(mine.find((r) => r.targetId === trail.bad)?.preview).toEqual({ title: `${tag} bad`, trailId: trail.bad })
    expect(mine.find((r) => r.targetId === review)?.preview).toEqual({ text: 'rude review', trailId: trail.host })
    expect(mine.find((r) => r.targetId === photo)?.preview?.imageUrl).toContain(photoPath)
    expect(mine.filter((r) => r.reporter === `rls_${tag}_rep`).length).toBeGreaterThan(0)
  })
})

describe('resolving', () => {
  const reportId = async (targetId: string) => (await sql(`select id from public.reports where target_id = $1 limit 1`, [targetId])).rows[0].id as string

  it('hiding a trail archives it and closes every open report on it', async () => {
    expect(await service.resolve(await reportId(trail.bad), 'hide', users.moderator)).toMatchObject({ status: 'hidden' })
    expect((await sql(`select status from public.sidequests where id = $1`, [trail.bad])).rows[0].status).toBe('archived')
    expect((await reportsOn(trail.bad)).map((r) => [r.status, r.resolved_by])).toEqual([
      ['hidden', id.moderator],
      ['hidden', id.moderator],
    ])
  })

  it('dismissing leaves the trail alone', async () => {
    expect(await service.resolve(await reportId(trail.fine), 'dismiss', users.moderator)).toMatchObject({ status: 'dismissed' })
    expect((await sql(`select status from public.sidequests where id = $1`, [trail.fine])).rows[0].status).toBe('published')
  })

  it('hiding a review deletes it', async () => {
    await service.resolve(await reportId(review), 'hide', users.moderator)
    expect((await sql(`select 1 from public.sidequest_ratings where id = $1`, [review])).rowCount).toBe(0)
  })

  it('hiding a photo deletes the record and the file', async () => {
    expect(await fileExists(photoPath)).toBe(true)
    await service.resolve(await reportId(photo), 'hide', users.moderator)
    expect((await sql(`select 1 from public.quest_photos where id = $1`, [photo])).rowCount).toBe(0)
    expect(await fileExists(photoPath)).toBe(false)
  })

  it('hiding a privately stored photo deletes its file too', async () => {
    expect(await fileExists(privatePath, 'photos')).toBe(true)
    await service.resolve(await reportId(privatePhoto), 'hide', users.moderator)
    expect((await sql(`select 1 from public.quest_photos where id = $1`, [privatePhoto])).rowCount).toBe(0)
    expect(await fileExists(privatePath, 'photos')).toBe(false)
  })

  it('a handled report is 409; an unknown one is 404', async () => {
    await expect(service.resolve(await reportId(trail.fine), 'hide', users.moderator)).rejects.toBeInstanceOf(ConflictException)
    await expect(service.resolve(randomUUID(), 'hide', users.moderator)).rejects.toBeInstanceOf(NotFoundException)
  })
})
