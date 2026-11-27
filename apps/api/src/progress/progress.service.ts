/**
 * The signed-in caller's progress on trails, with exactly the transition rules of the
 * web's lib/api/progress.ts:
 *
 *   current \ action   save     unsave                    start        finish     abort
 *   (no row)           saved    –                         in_progress  completed  –
 *   saved              –        removed, or aborted (1)   in_progress  completed  aborted
 *   signed_up          –        –                         in_progress  completed  aborted
 *   in_progress        saved    –                         – (resume)   completed  aborted
 *   completed          –        –                         –            –          –
 *   aborted            saved    –                         in_progress  completed  –
 *
 *   (1) aborted if it was started, which keeps the history and ticked crumbs.
 *
 * A finished trail never moves. Crumbs can be ticked only while the trail is in
 * progress (RLS: private.can_complete_item, migration
 * restrict_crumb_ticks_to_trails_in_progress); that refusal is a 403. Stopping keeps
 * earlier ticks, and starting again continues with them.
 * Runs as the caller, so RLS enforces the rest: you can only write your own row,
 * and only add one for a trail you can see. Database refusals become a 404 "not
 * available"; anything unexpected is a 500.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrumbState, TrailAction, TrailProgress, UserSidequestStatus } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type Row = { status: UserSidequestStatus; started_at: string | null }
type DbError = { code?: string; message?: string }

const SAVE_FROM: ReadonlyArray<UserSidequestStatus | null> = [null, 'in_progress', 'aborted']

/** Each action's resulting status and the statuses it may start from (null = no row). */
const ACTIONS: Record<TrailAction, { next: UserSidequestStatus; from: ReadonlyArray<UserSidequestStatus | null> }> = {
  start: { next: 'in_progress', from: [null, 'saved', 'signed_up', 'aborted'] },
  finish: { next: 'completed', from: [null, 'saved', 'signed_up', 'in_progress', 'aborted'] },
  abort: { next: 'aborted', from: ['saved', 'signed_up', 'in_progress'] },
}

/** RLS refused (hidden trail), the trail is gone, or the id is malformed: all mean "not available". */
const UNAVAILABLE_CODES = new Set(['42501', '23503', '22P02'])

function rethrow(error: DbError): never {
  if (error.code && UNAVAILABLE_CODES.has(error.code)) throw new NotFoundException('This trail isn’t available anymore.')
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class ProgressService {
  constructor(private readonly clients: SupabaseClients) {}

  /** The caller's status on a trail, or null when they have no row. */
  async status(trailId: string, user: AuthUser): Promise<TrailProgress> {
    const row = await this.read(this.clients.forUser(user), user.id, trailId)
    return { status: row?.status ?? null }
  }

  /** Start, finish or abort: moves the row only from the statuses the table allows. */
  async act(trailId: string, action: TrailAction, user: AuthUser): Promise<TrailProgress> {
    const db = this.clients.forUser(user)
    const { next, from } = ACTIONS[action]
    const row = await this.read(db, user.id, trailId)
    if (!from.includes(row?.status ?? null)) return { status: row?.status ?? null }
    await this.write(db, user.id, trailId, next)
    return { status: next }
  }

  /** Ids of the crumbs the caller has ticked on a trail. */
  async tickedCrumbs(trailId: string, user: AuthUser): Promise<string[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('checklist_completions')
      .select('checklist_item_id, checklist_items!inner(sidequest_id)')
      .eq('user_id', user.id)
      .eq('checklist_items.sidequest_id', trailId)
      .returns<{ checklist_item_id: string }[]>()
    if (error) rethrow(error)
    return data.map((row) => row.checklist_item_id)
  }

  /** Tick (idempotent) or untick a crumb. Ticking needs the trail in progress. */
  async setCrumb(crumbId: string, done: boolean, user: AuthUser): Promise<CrumbState> {
    const db = this.clients.forUser(user)
    const { error } = done
      ? await db
          .from('checklist_completions')
          .upsert({ user_id: user.id, checklist_item_id: crumbId }, { onConflict: 'user_id,checklist_item_id', ignoreDuplicates: true })
      : await db.from('checklist_completions').delete().eq('user_id', user.id).eq('checklist_item_id', crumbId)
    if (error?.code === '42501') throw new ForbiddenException('Start this trail before checking off its crumbs.')
    if (error) rethrow(error)
    return { done }
  }

  async save(trailId: string, user: AuthUser): Promise<TrailProgress> {
    const db = this.clients.forUser(user)
    const row = await this.read(db, user.id, trailId)
    if (!SAVE_FROM.includes(row?.status ?? null)) return { status: row?.status ?? null }
    await this.write(db, user.id, trailId, 'saved')
    return { status: 'saved' }
  }

  async unsave(trailId: string, user: AuthUser): Promise<TrailProgress> {
    const db = this.clients.forUser(user)
    const row = await this.read(db, user.id, trailId)
    if (row?.status !== 'saved') return { status: row?.status ?? null }
    // Paused mid-trail: keep the history (and ticked crumbs) but take it off Saved.
    if (row.started_at) {
      await this.write(db, user.id, trailId, 'aborted')
      return { status: 'aborted' }
    }
    const { error } = await db.from('user_sidequests').delete().eq('user_id', user.id).eq('sidequest_id', trailId)
    if (error) rethrow(error)
    return { status: null }
  }

  private async read(db: SupabaseClient, userId: string, trailId: string): Promise<Row | null> {
    const { data, error } = await db
      .from('user_sidequests')
      .select('status, started_at')
      .eq('user_id', userId)
      .eq('sidequest_id', trailId)
      .returns<Row[]>()
      .maybeSingle()
    if (error) rethrow(error)
    return data
  }

  /** Upserts the row's status; the database trigger fills started_at / completed_at. */
  private async write(db: SupabaseClient, userId: string, trailId: string, status: UserSidequestStatus) {
    const { error } = await db
      .from('user_sidequests')
      .upsert({ user_id: userId, sidequest_id: trailId, status }, { onConflict: 'user_id,sidequest_id' })
    if (error) rethrow(error)
  }
}
