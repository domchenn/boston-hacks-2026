/**
 * Trail data for the Explore feed and the Trail detail page.
 *
 *   getFeed(filters) → FeedTrail[]   published trails for Explore (category,
 *                                     neighborhood, cost, length, late-night filters)
 *   getTrail(id)     → TrailDetail   one trail with stops, crumbs and reviews
 *
 * With VITE_API_URL set, both go through the Breadcrumb API (GET /v1/trails and
 * /v1/trails/:id) via src/lib/apiClient.ts, which returns these same shapes and applies
 * the same RLS as the caller; without it they query Supabase directly, as below.
 *
 * Words: a "trail" is a row in `sidequests`, its stops are `sidequest_stops`
 * and its "crumbs" are `checklist_items`. Visibility (drafts, community-only
 * trails) is enforced by RLS, so these only ever return what the user may see.
 */

import { getApi } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import type { Category, SidequestStatus, TransitLine, TravelMode, ChecklistItemType, TrailVisibility } from '@/types/db-values'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrailCreator = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'avatar_url'>

export type TrailRating = {
  /** Average of the four scores (price, time, enjoyment, memorability), 1–5. Null if unrated. */
  average: number | null
  count: number
}

/** One card on the Explore page. */
export type FeedTrail = {
  id: string
  title: string
  description: string | null
  category: Category | null
  /** The creator's own category name when category is 'other'. */
  customCategory: string | null
  neighborhood: string | null
  coverImageUrl: string | null
  /** Rough total cost per person in USD. */
  estimatedCost: number | null
  estimatedMinutes: number | null
  /** Null = anytime trail; set = scheduled outing people can join. */
  scheduledAt: string | null
  primaryLine: TransitLine | null
  isCurated: boolean
  createdAt: string
  creator: TrailCreator | null
  stopCount: number
  crumbCount: number
  firstStopName: string | null
  lastStopName: string | null
  rating: TrailRating
  /** Every stop in order, for search and the map / "Near a T station" filter. Set by getFeed only. */
  places?: FeedPlace[]
}

/** A stop as the feed sees it: its name, where it is, and whether its place is open late. */
export type FeedPlace = {
  name: string
  latitude: number | null
  longitude: number | null
  /** The linked place (experiences.open_late) is open late. False for places typed in by hand. */
  openLate: boolean
}

export type FeedFilters = {
  /** Only trails in this neighborhood (exact match on sidequests.neighborhood). */
  neighborhood?: string
  /** Only trails where at least one stop's place is open late. */
  lateNight?: boolean
  category?: Category
  /** Only trails costing at least this many dollars. */
  minCost?: number
  /** Only trails costing at most this many dollars. */
  maxCost?: number
  /** Only trails taking at most this many minutes. */
  maxMinutes?: number
  /** Only trails limited to this community (task G6). Non-members get none: RLS hides them. */
  communityId?: string
}

export type TrailCrumb = {
  id: string
  label: string
  type: ChecklistItemType
  order: number
  /** Null when the crumb is on the way between stops rather than at one. */
  stopId: string | null
}

export type TrailStop = {
  id: string
  order: number
  placeName: string
  address: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  plannedActivity: string | null
  /** How to get here from the previous stop. Null for the first stop. */
  travelModeToStop: TravelMode | null
  estimatedCost: number | null
  notes: string | null
  crumbs: TrailCrumb[]
}

export type TrailReview = {
  id: string
  priceRating: number
  timeRating: number
  enjoymentRating: number
  memorabilityRating: number
  /** Average of the four scores. */
  overall: number
  text: string | null
  createdAt: string
  reviewer: TrailCreator | null
}

export type TrailRatingBreakdown = TrailRating & {
  price: number | null
  time: number | null
  enjoyment: number | null
  memorability: number | null
}

/** Everything the Trail detail page shows. */
/** The trail a remix was copied from (task G8). */
export type TrailRemixSource = { id: string; title: string; creator: TrailCreator | null }

export type TrailDetail = Omit<FeedTrail, 'rating'> & {
  status: SidequestStatus
  /** Who can see it: everyone, the creator's friends, or their close friends. */
  visibility: TrailVisibility
  communityId: string | null
  /** Set when this trail is a remix and the original is still visible to you; null otherwise. */
  remixedFrom: TrailRemixSource | null
  stops: TrailStop[]
  /** Crumbs not tied to a stop (e.g. something to see between stops). */
  betweenStopCrumbs: TrailCrumb[]
  rating: TrailRatingBreakdown
  reviews: TrailReview[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CREATOR_FIELDS = 'id, username, display_name, avatar_url'

/** Postgres numeric columns can arrive as strings; normalise to number | null. */
function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Rating stats for many trails at once, keyed by trail id. */
async function fetchRatingStats(trailIds: string[]) {
  const stats = new Map<string, Tables<'sidequest_rating_stats'>>()
  if (trailIds.length === 0) return stats
  const { data, error } = await supabase.from('sidequest_rating_stats').select('*').in('sidequest_id', trailIds)
  if (error) throw error
  for (const row of data ?? []) if (row.sidequest_id) stats.set(row.sidequest_id, row)
  return stats
}

function toCrumb(row: Pick<Tables<'checklist_items'>, 'id' | 'label' | 'item_type' | 'item_order' | 'stop_id'>): TrailCrumb {
  return {
    id: row.id,
    label: row.label,
    type: row.item_type as ChecklistItemType,
    order: row.item_order,
    stopId: row.stop_id,
  }
}

// ---------------------------------------------------------------------------
// getFeed
// ---------------------------------------------------------------------------

/** Published trails the user can see, newest first, with card details. */
export async function getFeed(filters: FeedFilters = {}): Promise<FeedTrail[]> {
  const api = getApi()
  if (api) return (await api).getTrails(filters)

  let query = supabase
    .from('sidequests')
    .select(
      `id, title, description, category, custom_category, neighborhood, cover_image_url, estimated_cost,
       estimated_duration_minutes, scheduled_at, primary_line, is_curated, created_at,
       creator:profiles!sidequests_creator_id_fkey(${CREATOR_FIELDS}),
       sidequest_stops(place_name, stop_order, latitude, longitude, experience:experiences(open_late)),
       checklist_items(count)`,
    )
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (filters.neighborhood) query = query.eq('neighborhood', filters.neighborhood)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.minCost !== undefined) query = query.gte('estimated_cost', filters.minCost)
  if (filters.maxCost !== undefined) query = query.lte('estimated_cost', filters.maxCost)
  if (filters.maxMinutes !== undefined) query = query.lte('estimated_duration_minutes', filters.maxMinutes)
  if (filters.communityId) query = query.eq('community_id', filters.communityId)

  const { data, error } = await query
  if (error) throw error
  // Late night is checked here rather than in SQL so the stops list above stays complete.
  const rows = (data ?? []).filter(
    (row) => !filters.lateNight || row.sidequest_stops.some((stop) => stop.experience?.open_late === true),
  )
  const stats = await fetchRatingStats(rows.map((r) => r.id))

  return rows.map((row) => {
    const stops = [...row.sidequest_stops].sort((a, b) => a.stop_order - b.stop_order)
    const s = stats.get(row.id)
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category as Category | null,
      customCategory: row.custom_category,
      neighborhood: row.neighborhood,
      coverImageUrl: row.cover_image_url,
      estimatedCost: num(row.estimated_cost),
      estimatedMinutes: row.estimated_duration_minutes,
      scheduledAt: row.scheduled_at,
      primaryLine: row.primary_line as TransitLine | null,
      isCurated: row.is_curated,
      createdAt: row.created_at,
      creator: row.creator,
      stopCount: stops.length,
      crumbCount: row.checklist_items[0]?.count ?? 0,
      firstStopName: stops[0]?.place_name ?? null,
      lastStopName: stops.length > 1 ? stops[stops.length - 1].place_name : null,
      rating: { average: num(s?.avg_overall), count: s?.rating_count ?? 0 },
      places: stops.map((stop) => ({
        name: stop.place_name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        openLate: stop.experience?.open_late === true,
      })),
    }
  })
}

// ---------------------------------------------------------------------------
// getTrail
// ---------------------------------------------------------------------------

/**
 * The original a remix was copied from, if you can still see it (RLS). Only the
 * credit line depends on it, so any failure just hides the credit.
 */
async function fetchRemixSource(id: string): Promise<TrailRemixSource | null> {
  const { data, error } = await supabase
    .from('sidequests')
    .select(`id, title, creator:profiles!sidequests_creator_id_fkey(${CREATOR_FIELDS})`)
    .eq('id', id)
    .maybeSingle()
  return error || !data ? null : { id: data.id, title: data.title, creator: data.creator }
}

/** One trail with everything the detail page needs, or null if it doesn't exist or isn't visible. */
export async function getTrail(id: string): Promise<TrailDetail | null> {
  const api = getApi()
  if (api) return (await api).getTrail(id)

  const { data: row, error } = await supabase
    .from('sidequests')
    .select(
      `id, title, description, category, custom_category, neighborhood, cover_image_url, estimated_cost,
       estimated_duration_minutes, scheduled_at, primary_line, is_curated, created_at,
       status, visibility, community_id, remixed_from,
       creator:profiles!sidequests_creator_id_fkey(${CREATOR_FIELDS}),
       sidequest_stops(id, stop_order, place_name, address, latitude, longitude, description,
                       planned_activity, travel_mode_to_stop, estimated_cost, notes),
       checklist_items(id, label, item_type, item_order, stop_id),
       sidequest_ratings(id, price_rating, time_rating, enjoyment_rating, memorability_rating,
                         review_text, created_at,
                         reviewer:profiles!sidequest_ratings_user_id_fkey(${CREATOR_FIELDS}))`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!row) return null

  const stats = (await fetchRatingStats([row.id])).get(row.id)
  const crumbs = row.checklist_items.map(toCrumb).sort((a, b) => a.order - b.order)
  const stops = [...row.sidequest_stops]
    .sort((a, b) => a.stop_order - b.stop_order)
    .map<TrailStop>((stop) => ({
      id: stop.id,
      order: stop.stop_order,
      placeName: stop.place_name,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      description: stop.description,
      plannedActivity: stop.planned_activity,
      travelModeToStop: stop.travel_mode_to_stop as TravelMode | null,
      estimatedCost: num(stop.estimated_cost),
      notes: stop.notes,
      crumbs: crumbs.filter((c) => c.stopId === stop.id),
    }))

  const reviews = [...row.sidequest_ratings]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map<TrailReview>((r) => ({
      id: r.id,
      priceRating: r.price_rating,
      timeRating: r.time_rating,
      enjoymentRating: r.enjoyment_rating,
      memorabilityRating: r.memorability_rating,
      overall: (r.price_rating + r.time_rating + r.enjoyment_rating + r.memorability_rating) / 4,
      text: r.review_text,
      createdAt: r.created_at,
      reviewer: r.reviewer,
    }))

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as Category | null,
      customCategory: row.custom_category,
    neighborhood: row.neighborhood,
    coverImageUrl: row.cover_image_url,
    estimatedCost: num(row.estimated_cost),
    estimatedMinutes: row.estimated_duration_minutes,
    scheduledAt: row.scheduled_at,
    primaryLine: row.primary_line as TransitLine | null,
    isCurated: row.is_curated,
    createdAt: row.created_at,
    status: row.status as SidequestStatus,
    visibility: row.visibility as TrailVisibility,
    communityId: row.community_id,
    remixedFrom: row.remixed_from ? await fetchRemixSource(row.remixed_from) : null,
    creator: row.creator,
    stopCount: stops.length,
    crumbCount: crumbs.length,
    firstStopName: stops[0]?.placeName ?? null,
    lastStopName: stops.length > 1 ? stops[stops.length - 1].placeName : null,
    stops,
    betweenStopCrumbs: crumbs.filter((c) => c.stopId === null),
    rating: {
      average: num(stats?.avg_overall),
      count: stats?.rating_count ?? 0,
      price: num(stats?.avg_price),
      time: num(stats?.avg_time),
      enjoyment: num(stats?.avg_enjoyment),
      memorability: num(stats?.avg_memorability),
    },
    reviews,
  }
}
