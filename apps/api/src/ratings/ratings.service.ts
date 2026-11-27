/**
 * The signed-in caller's rating of a trail (M14b), read and written as the caller in
 * sidequest_ratings (one row per user per trail, so rating again edits it). The rules
 * stay in the database trigger validate_rating, which the API only translates:
 *
 *   "only rate a sidequest you have completed" (23514) → 422
 *   "Creators cannot rate their own sidequest"  (23514) → 403
 *   trail gone or id malformed (23503, 22P02)          → 404
 *
 * RLS lets you write only your own row and read ratings on trails you can see, so a
 * rating on a trail that is now hidden from you reads back as null. Same behaviour as
 * the web's lib/api/ratings.ts: a blank review is stored as none.
 */
import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MyRating, RatingBody } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type DbError = { code?: string; message?: string }
type Row = {
  id: string
  price_rating: number
  time_rating: number
  enjoyment_rating: number
  memorability_rating: number
  review_text: string | null
  created_at: string
}

const COLUMNS = 'id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text, created_at'

function rethrow(error: DbError): never {
  const message = error.message ?? ''
  if (error.code === '23514' && /completed/i.test(message)) {
    throw new UnprocessableEntityException('Finish this trail first, then you can rate it.')
  }
  if (error.code === '23514' && /creator|own/i.test(message)) {
    throw new ForbiddenException('You made this trail, so you can’t rate it.')
  }
  if (error.code === '23503' || error.code === '22P02') throw new NotFoundException('This trail isn’t available anymore.')
  throw Object.assign(new Error(message || 'database error'), { code: error.code })
}

const toRating = (row: Row): MyRating => ({
  id: row.id,
  price: row.price_rating,
  time: row.time_rating,
  enjoyment: row.enjoyment_rating,
  memorability: row.memorability_rating,
  review: row.review_text,
  createdAt: row.created_at,
})

@Injectable()
export class RatingsService {
  constructor(private readonly clients: SupabaseClients) {}

  /** The caller's rating of a trail, or null. */
  get(trailId: string, user: AuthUser): Promise<MyRating | null> {
    return this.read(this.clients.forUser(user), user.id, trailId)
  }

  /** Creates or edits the caller's rating, then reads it back. */
  async rate(trailId: string, body: RatingBody, user: AuthUser): Promise<MyRating | null> {
    const db = this.clients.forUser(user)
    const { error } = await db.from('sidequest_ratings').upsert(
      {
        user_id: user.id,
        sidequest_id: trailId,
        price_rating: body.price,
        time_rating: body.time,
        enjoyment_rating: body.enjoyment,
        memorability_rating: body.memorability,
        review_text: body.review?.trim() || null,
      },
      { onConflict: 'user_id,sidequest_id' },
    )
    if (error) rethrow(error)
    return this.read(db, user.id, trailId)
  }

  /** Deletes the caller's rating; nothing happens if there isn't one. */
  async remove(trailId: string, user: AuthUser): Promise<void> {
    const { error } = await this.clients
      .forUser(user)
      .from('sidequest_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('sidequest_id', trailId)
    if (error) rethrow(error)
  }

  private async read(db: SupabaseClient, userId: string, trailId: string): Promise<MyRating | null> {
    const { data, error } = await db
      .from('sidequest_ratings')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('sidequest_id', trailId)
      .returns<Row[]>()
      .maybeSingle()
    if (error) rethrow(error)
    return data ? toRating(data) : null
  }
}
