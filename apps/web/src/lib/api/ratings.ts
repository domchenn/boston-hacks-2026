/**
 * Rating a finished trail: price, time, enjoyment and memorability (1–5 each)
 * plus an optional written review, stored in sidequest_ratings (one row per user
 * per trail, so rating again edits it). The database only accepts a rating from
 * someone whose user_sidequests status is 'completed', and never from the trail's
 * creator; RLS lets you write only your own row. Failures throw a RatingError
 * whose `message` is ready to show.
 *
 * With VITE_API_URL set, all three go through the API (GET / PUT / DELETE
 * /v1/me/trails/:trailId/rating), which keeps the same rules and answers 422 for an
 * unfinished trail and 403 for your own; the errors and messages here stay the same.
 *
 * Owner: Jason (task J3). Used by the Rate page (/trails/:id/rate) and the Trail
 * detail page's "Rate this trail" button. Signatures are the agreed contract.
 */

import { getApi } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'

export type RatingInput = {
  price: number
  time: number
  enjoyment: number
  memorability: number
  review?: string | null
}

export type MyRating = RatingInput & { id: string; createdAt: string }

/** Longest review the database accepts (check constraint on review_text). */
export const MAX_REVIEW_LENGTH = 2000

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type RatingErrorCode =
  | 'not_signed_in'
  | 'not_finished'
  | 'own_trail'
  | 'already_rated'
  | 'invalid'
  | 'unavailable'
  | 'network'
  | 'unknown'

/** Thrown by rateTrail / getMyRating / deleteMyRating. `message` is user-facing. */
export class RatingError extends Error {
  readonly code: RatingErrorCode
  constructor(code: RatingErrorCode, message = MESSAGES[code]) {
    super(message)
    this.name = 'RatingError'
    this.code = code
  }
}

const MESSAGES: Record<RatingErrorCode, string> = {
  not_signed_in: 'Log in to rate trails.',
  not_finished: 'Finish this trail first, then you can rate it.',
  own_trail: "You made this trail, so you can't rate it.",
  already_rated: "You've already rated this trail.",
  invalid: 'Pick 1 to 5 stars for each question.',
  unavailable: "This trail isn't available anymore.",
  network: "We couldn't reach breadcrumb. Check your connection and try again.",
  unknown: 'Something went wrong. Please try again.',
}

/** User-facing text for anything these functions threw. */
export function ratingErrorMessage(error: unknown): string {
  return error instanceof RatingError ? error.message : MESSAGES.unknown
}

type DbError = { code?: string; message?: string } | null

/** Turns a Supabase/Postgres error into a RatingError. */
function toRatingError(error: DbError): RatingError {
  const code = error?.code ?? ''
  const message = error?.message ?? ''
  // No code: the request never reached the database.
  if (!code) return new RatingError('network')
  // check_violation: raised by the validate_rating trigger, or a column check.
  if (code === '23514') {
    if (/completed/i.test(message)) return new RatingError('not_finished')
    if (/creator|own/i.test(message)) return new RatingError('own_trail')
    if (/review_text/i.test(message)) {
      return new RatingError('invalid', `Keep your review under ${MAX_REVIEW_LENGTH.toLocaleString('en-US')} characters.`)
    }
    return new RatingError('invalid')
  }
  // unique (user_id, sidequest_id): only reachable if two posts race.
  if (code === '23505') return new RatingError('already_rated')
  // RLS / grants refused the write: logged out, or the login expired.
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') return new RatingError('not_signed_in')
  // Foreign key / bad id: the trail no longer exists.
  if (code === '23503' || code === '22P02') return new RatingError('unavailable')
  return new RatingError('unknown')
}

/** Turns an API failure into a RatingError (API errors carry an HTTP status). */
function apiRatingError(error: unknown): RatingError {
  const status = error instanceof Error && 'status' in error ? Number((error as { status: unknown }).status) : 0
  const codes: Record<number, RatingErrorCode> = { 400: 'invalid', 401: 'not_signed_in', 403: 'own_trail', 404: 'unavailable', 422: 'not_finished' }
  return new RatingError(status ? (codes[status] ?? 'unknown') : 'network')
}

type Api = NonNullable<Awaited<ReturnType<typeof getApi>>>

/** Runs an API call, translating its failures; callers already checked sign-in. */
async function viaApi<T>(action: (api: Api) => Promise<T>): Promise<T> {
  try {
    return await action((await getApi())!)
  } catch (error) {
    throw apiRatingError(error)
  }
}

/** Runs a Supabase call and rethrows anything as a RatingError. */
async function attempt<T>(call: () => PromiseLike<{ data: T; error: DbError }>): Promise<T> {
  try {
    const { data, error } = await call()
    if (error) throw toRatingError(error)
    return data
  } catch (error) {
    throw error instanceof RatingError ? error : toRatingError(null)
  }
}

/** The logged-in user's id (read locally, no network), or null when logged out. */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId()
  if (!id) throw new RatingError('not_signed_in')
  return id
}

const isScore = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5

// ---------------------------------------------------------------------------
// Agreed contract
// ---------------------------------------------------------------------------

/** The current user's rating of a trail, or null if they haven't rated it (or are logged out). */
export async function getMyRating(trailId: string): Promise<MyRating | null> {
  const userId = await currentUserId()
  if (!userId) return null
  if (getApi()) return viaApi((api) => api.getMyRating(trailId))
  const row = await attempt(() =>
    supabase
      .from('sidequest_ratings')
      .select('id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text, created_at')
      .eq('user_id', userId)
      .eq('sidequest_id', trailId)
      .maybeSingle(),
  )
  if (!row) return null
  return {
    id: row.id,
    price: row.price_rating,
    time: row.time_rating,
    enjoyment: row.enjoyment_rating,
    memorability: row.memorability_rating,
    review: row.review_text,
    createdAt: row.created_at,
  }
}

/** Create or update the current user's rating (upsert on user + trail). */
export async function rateTrail(trailId: string, rating: RatingInput): Promise<void> {
  const userId = await requireUserId()
  const { price, time, enjoyment, memorability } = rating
  if (![price, time, enjoyment, memorability].every(isScore)) throw new RatingError('invalid')
  const review = rating.review?.trim() || null
  if (review && review.length > MAX_REVIEW_LENGTH) {
    throw new RatingError('invalid', `Keep your review under ${MAX_REVIEW_LENGTH.toLocaleString('en-US')} characters.`)
  }
  if (getApi()) {
    await viaApi((api) => api.rateTrail(trailId, { price, time, enjoyment, memorability, review }))
    return
  }
  await attempt(() =>
    supabase.from('sidequest_ratings').upsert(
      {
        user_id: userId,
        sidequest_id: trailId,
        price_rating: price,
        time_rating: time,
        enjoyment_rating: enjoyment,
        memorability_rating: memorability,
        review_text: review,
      },
      { onConflict: 'user_id,sidequest_id' },
    ),
  )
}

/** Delete the current user's rating of a trail. Does nothing if there isn't one. */
export async function deleteMyRating(trailId: string): Promise<void> {
  const userId = await requireUserId()
  if (getApi()) return viaApi((api) => api.deleteMyRating(trailId))
  await attempt(() => supabase.from('sidequest_ratings').delete().eq('user_id', userId).eq('sidequest_id', trailId))
}
