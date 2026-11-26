/**
 * Saving and unsaving trails for the signed-in caller, with exactly the transition
 * rules of the web's lib/api/progress.ts:
 *
 *   current \ action   save     unsave
 *   (no row)           saved    –
 *   saved              –        removed, or aborted if it was started (keeps history)
 *   signed_up          –        –
 *   in_progress        saved    –          ("save for later")
 *   completed          –        –          (a finished trail never moves)
 *   aborted            saved    –
 *
 * Runs as the caller, so RLS enforces the rest: you can only write your own row,
 * and only add one for a trail you can see. Database refusals become a 404 "not
 * available"; anything unexpected is a 500.
 */
import { Injectable, NotFoundException } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TrailProgress, UserSidequestStatus } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type Row = { status: UserSidequestStatus; started_at: string | null }
type DbError = { code?: string; message?: string }

const SAVE_FROM: ReadonlyArray<UserSidequestStatus | null> = [null, 'in_progress', 'aborted']

/** RLS refused (hidden trail), the trail is gone, or the id is malformed: all mean "not available". */
const UNAVAILABLE_CODES = new Set(['42501', '23503', '22P02'])

function rethrow(error: DbError): never {
  if (error.code && UNAVAILABLE_CODES.has(error.code)) throw new NotFoundException('This trail isn’t available anymore.')
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class ProgressService {
  constructor(private readonly clients: SupabaseClients) {}

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
