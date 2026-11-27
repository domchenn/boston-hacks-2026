/**
 * Ratings contract (M14b): the caller's own rating of a trail. GET, PUT (create or
 * edit) and DELETE /v1/me/trails/:trailId/rating all answer { rating }, null when
 * there is none. The rules (finish the trail first, never your own trail) live in the
 * database trigger validate_rating; the field limits here match its column checks.
 */
import { z } from 'zod'

const Score = z.number().int().min(1).max(5)

/** Longest review the database accepts (check constraint on review_text). */
export const MAX_REVIEW_LENGTH = 2000

/** PUT /v1/me/trails/:trailId/rating body. A blank review is stored as none. */
export const RatingBody = z
  .object({
    price: Score,
    time: Score,
    enjoyment: Score,
    memorability: Score,
    review: z.string().max(MAX_REVIEW_LENGTH).nullable().optional(),
  })
  .strict()
export type RatingBody = z.infer<typeof RatingBody>

export const MyRating = z.object({
  id: z.uuid(),
  price: Score,
  time: Score,
  enjoyment: Score,
  memorability: Score,
  review: z.string().nullable(),
  createdAt: z.string(),
})
export type MyRating = z.infer<typeof MyRating>

/** Every rating endpoint's response: the caller's rating after the call, or null. */
export const MyRatingResponse = z.object({ rating: MyRating.nullable() })
export type MyRatingResponse = z.infer<typeof MyRatingResponse>
