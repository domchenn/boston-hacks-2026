/**
 * Explore contract (M15a): the Trending tab (GET /v1/trending, sign-in required, from
 * the database function trending_trails: per-trail totals only, never who) and the
 * neighborhood filter list (GET /v1/neighborhoods, sign-in optional). Same data as
 * the web's features/explore/api.ts.
 */
import { z } from 'zod'

/** GET /v1/trending query. trending_trails() clamps days to 1–90 and limit to 0–100. */
export const TrendingQuery = z
  .object({
    days: z.coerce.number().int().min(1).max(90).optional(),
    limit: z.coerce.number().int().min(0).max(100).optional(),
  })
  .strict()
export type TrendingQuery = z.infer<typeof TrendingQuery>

/** One trending trail: its activity score and how many different people were active on it. */
export const TrendingEntry = z.object({ trailId: z.uuid(), score: z.number().int(), people: z.number().int() })
export type TrendingEntry = z.infer<typeof TrendingEntry>

/** Busiest first. Trails with no recent activity are left out. */
export const TrendingList = z.object({ trails: z.array(TrendingEntry) })
export type TrendingList = z.infer<typeof TrendingList>

/** Neighborhoods with at least one published trail the caller can see, A to Z. */
export const NeighborhoodList = z.object({ neighborhoods: z.array(z.string()) })
export type NeighborhoodList = z.infer<typeof NeighborhoodList>
