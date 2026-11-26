/**
 * Trail read contract: the JSON shapes of GET /v1/trails and GET /v1/trails/:id,
 * and the list's query parameters. Field names and meanings match the web app's
 * FeedTrail and TrailDetail (apps/web/src/lib/api/trails.ts), so the web can switch
 * from Supabase to the API without changing its components.
 *
 * Words: a "trail" is a `sidequests` row, its stops are `sidequest_stops` and its
 * "crumbs" are `checklist_items`. Timestamps are ISO 8601 strings.
 */
import { z } from 'zod'
import { Category, ChecklistItemType, SidequestStatus, TrailVisibility, TransitLine, TravelMode } from './values.js'

const Uuid = z.uuid()
const Timestamp = z.string().describe('ISO 8601 timestamp')
const Rating = z.number().min(1).max(5)

export const TrailCreator = z.object({
  id: Uuid,
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
})
export type TrailCreator = z.infer<typeof TrailCreator>

export const TrailRating = z.object({
  /** Average of the four scores (price, time, enjoyment, memorability), 1–5. Null if unrated. */
  average: Rating.nullable(),
  count: z.number().int().min(0),
})
export type TrailRating = z.infer<typeof TrailRating>

/** A stop as the feed sees it: its name, where it is, and whether its place is open late. */
export const FeedPlace = z.object({
  name: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /** The linked place is open late. False for places typed in by hand. */
  openLate: z.boolean(),
})
export type FeedPlace = z.infer<typeof FeedPlace>

const TrailSummaryFields = {
  id: Uuid,
  title: z.string(),
  description: z.string().nullable(),
  category: Category.nullable(),
  /** The creator's own category name when category is 'other'. */
  customCategory: z.string().nullable(),
  neighborhood: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  /** Rough total cost per person in USD. */
  estimatedCost: z.number().min(0).nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  /** Null = anytime trail; set = an older scheduled outing. */
  scheduledAt: Timestamp.nullable(),
  primaryLine: TransitLine.nullable(),
  isCurated: z.boolean(),
  createdAt: Timestamp,
  creator: TrailCreator.nullable(),
  stopCount: z.number().int().min(0),
  crumbCount: z.number().int().min(0),
  firstStopName: z.string().nullable(),
  lastStopName: z.string().nullable(),
}

/** One card on the Explore feed (GET /v1/trails item). */
export const FeedTrail = z.object({
  ...TrailSummaryFields,
  rating: TrailRating,
  /** Every stop in order, for search, the map and the "near a T station" filter. */
  places: z.array(FeedPlace),
})
export type FeedTrail = z.infer<typeof FeedTrail>

/** GET /v1/trails response. */
export const TrailList = z.object({ trails: z.array(FeedTrail) })
export type TrailList = z.infer<typeof TrailList>

export const TrailCrumb = z.object({
  id: Uuid,
  label: z.string(),
  type: ChecklistItemType,
  order: z.number().int().min(0),
  /** Null when the crumb is on the way between stops rather than at one. */
  stopId: Uuid.nullable(),
})
export type TrailCrumb = z.infer<typeof TrailCrumb>

export const TrailStop = z.object({
  id: Uuid,
  order: z.number().int().min(0),
  placeName: z.string(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  description: z.string().nullable(),
  plannedActivity: z.string().nullable(),
  /** How to get here from the previous stop. Null for the first stop. */
  travelModeToStop: TravelMode.nullable(),
  estimatedCost: z.number().min(0).nullable(),
  notes: z.string().nullable(),
  crumbs: z.array(TrailCrumb),
})
export type TrailStop = z.infer<typeof TrailStop>

export const TrailReview = z.object({
  id: Uuid,
  priceRating: Rating,
  timeRating: Rating,
  enjoymentRating: Rating,
  memorabilityRating: Rating,
  /** Average of the four scores. */
  overall: Rating,
  text: z.string().nullable(),
  createdAt: Timestamp,
  reviewer: TrailCreator.nullable(),
})
export type TrailReview = z.infer<typeof TrailReview>

export const TrailRatingBreakdown = TrailRating.extend({
  price: Rating.nullable(),
  time: Rating.nullable(),
  enjoyment: Rating.nullable(),
  memorability: Rating.nullable(),
})
export type TrailRatingBreakdown = z.infer<typeof TrailRatingBreakdown>

/** The trail a remix was copied from, if the viewer can still see it. */
export const TrailRemixSource = z.object({ id: Uuid, title: z.string(), creator: TrailCreator.nullable() })
export type TrailRemixSource = z.infer<typeof TrailRemixSource>

/** Everything the Trail detail page shows (GET /v1/trails/:id). */
export const TrailDetail = z.object({
  ...TrailSummaryFields,
  status: SidequestStatus,
  visibility: TrailVisibility,
  communityId: Uuid.nullable(),
  remixedFrom: TrailRemixSource.nullable(),
  stops: z.array(TrailStop),
  /** Crumbs not tied to a stop (e.g. something to see between stops). */
  betweenStopCrumbs: z.array(TrailCrumb),
  rating: TrailRatingBreakdown,
  reviews: z.array(TrailReview),
})
export type TrailDetail = z.infer<typeof TrailDetail>

const flag = z.enum(['true', 'false']).transform((value) => value === 'true')
const amount = z.coerce.number().min(0)

/**
 * GET /v1/trails query parameters (all optional), matching the web's FeedFilters.
 * Query strings are text, so numbers and booleans are coerced; unknown keys are
 * rejected so typos fail loudly.
 */
export const TrailListQuery = z
  .object({
    neighborhood: z.string().trim().min(1).max(80).optional(),
    /** Only trails where at least one stop's place is open late. */
    lateNight: flag.optional(),
    category: Category.optional(),
    minCost: amount.optional(),
    maxCost: amount.optional(),
    maxMinutes: z.coerce.number().int().positive().max(10080).optional(),
    /** Only trails limited to this community; non-members get none (RLS). */
    communityId: Uuid.optional(),
  })
  .strict()
  .refine((q) => q.minCost === undefined || q.maxCost === undefined || q.minCost <= q.maxCost, {
    message: 'minCost must not exceed maxCost',
    path: ['minCost'],
  })
export type TrailListQuery = z.infer<typeof TrailListQuery>
/** The same filters as a caller writes them (numbers and booleans, before string encoding). */
export type TrailListFilters = {
  neighborhood?: string
  lateNight?: boolean
  category?: Category
  minCost?: number
  maxCost?: number
  maxMinutes?: number
  communityId?: string
}

/** GET /v1/trails/:id path parameters. */
export const TrailIdParams = z.object({ id: Uuid })
export type TrailIdParams = z.infer<typeof TrailIdParams>
