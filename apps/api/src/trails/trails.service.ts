/**
 * Trail reads for GET /v1/trails and GET /v1/trails/:id, ported from the web app's
 * getFeed/getTrail (apps/web/src/lib/api/trails.ts) with the same queries and
 * mapping, and returning the @breadcrumb/contracts shapes. Every query runs as the
 * caller (SupabaseClients), so RLS decides visibility: drafts, friends-only,
 * close-friends and community trails appear only for people allowed to see them.
 */
import { Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Category,
  ChecklistItemType,
  FeedTrail,
  SidequestStatus,
  TrailCreator,
  TrailCrumb,
  TrailDetail,
  TrailListQuery,
  TrailRemixSource,
  TrailReview,
  TrailStop,
  TrailVisibility,
  TransitLine,
  TravelMode,
} from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { num, type Numeric } from '../common/numeric.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

const CREATOR_FIELDS = 'id, username, display_name, avatar_url'

const FEED_SELECT = `id, title, description, category, custom_category, neighborhood, cover_image_url, estimated_cost,
  estimated_duration_minutes, scheduled_at, primary_line, is_curated, created_at,
  creator:profiles!sidequests_creator_id_fkey(${CREATOR_FIELDS}),
  sidequest_stops(place_name, stop_order, latitude, longitude, experience:experiences(open_late)),
  checklist_items(count)`

const DETAIL_SELECT = `id, title, description, category, custom_category, neighborhood, cover_image_url, estimated_cost,
  estimated_duration_minutes, scheduled_at, primary_line, is_curated, created_at,
  status, visibility, community_id, remixed_from,
  creator:profiles!sidequests_creator_id_fkey(${CREATOR_FIELDS}),
  sidequest_stops(id, stop_order, place_name, address, latitude, longitude, description,
                  planned_activity, travel_mode_to_stop, estimated_cost, notes),
  checklist_items(id, label, item_type, item_order, stop_id),
  sidequest_ratings(id, price_rating, time_rating, enjoyment_rating, memorability_rating,
                    review_text, created_at,
                    reviewer:profiles!sidequest_ratings_user_id_fkey(${CREATOR_FIELDS}))`


type SummaryRow = {
  id: string
  title: string
  description: string | null
  category: string | null
  custom_category: string | null
  neighborhood: string | null
  cover_image_url: string | null
  estimated_cost: Numeric
  estimated_duration_minutes: number | null
  scheduled_at: string | null
  primary_line: string | null
  is_curated: boolean
  created_at: string
  creator: TrailCreator | null
}

type FeedRow = SummaryRow & {
  sidequest_stops: {
    place_name: string
    stop_order: number
    latitude: number | null
    longitude: number | null
    experience: { open_late: boolean | null } | null
  }[]
  checklist_items: { count: number }[]
}

type CrumbRow = { id: string; label: string; item_type: string; item_order: number; stop_id: string | null }

type DetailRow = SummaryRow & {
  status: string
  visibility: string
  community_id: string | null
  remixed_from: string | null
  sidequest_stops: {
    id: string
    stop_order: number
    place_name: string
    address: string | null
    latitude: number | null
    longitude: number | null
    description: string | null
    planned_activity: string | null
    travel_mode_to_stop: string | null
    estimated_cost: Numeric
    notes: string | null
  }[]
  checklist_items: CrumbRow[]
  sidequest_ratings: {
    id: string
    price_rating: number
    time_rating: number
    enjoyment_rating: number
    memorability_rating: number
    review_text: string | null
    created_at: string
    reviewer: TrailCreator | null
  }[]
}

type RatingStatsRow = {
  sidequest_id: string | null
  rating_count: number | null
  avg_overall: Numeric
  avg_price: Numeric
  avg_time: Numeric
  avg_enjoyment: Numeric
  avg_memorability: Numeric
}


function toCrumb(row: CrumbRow): TrailCrumb {
  return { id: row.id, label: row.label, type: row.item_type as ChecklistItemType, order: row.item_order, stopId: row.stop_id }
}

@Injectable()
export class TrailsService {
  constructor(private readonly clients: SupabaseClients) {}

  /** Published trails the caller can see, newest first, with card details. */
  async list(filters: TrailListQuery, user: AuthUser | null): Promise<FeedTrail[]> {
    const db = this.clients.forUser(user)
    let query = db.from('sidequests').select(FEED_SELECT).eq('status', 'published').order('created_at', { ascending: false })

    if (filters.neighborhood) query = query.eq('neighborhood', filters.neighborhood)
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.minCost !== undefined) query = query.gte('estimated_cost', filters.minCost)
    if (filters.maxCost !== undefined) query = query.lte('estimated_cost', filters.maxCost)
    if (filters.maxMinutes !== undefined) query = query.lte('estimated_duration_minutes', filters.maxMinutes)
    if (filters.communityId) query = query.eq('community_id', filters.communityId)

    const { data, error } = await query.returns<FeedRow[]>()
    if (error) throw error
    // Late night is checked here rather than in SQL so each trail's stop list stays complete.
    const rows = (data ?? []).filter(
      (row) => !filters.lateNight || row.sidequest_stops.some((stop) => stop.experience?.open_late === true),
    )
    const stats = await this.ratingStats(db, rows.map((row) => row.id))

    return rows.map((row) => {
      const stops = [...row.sidequest_stops].sort((a, b) => a.stop_order - b.stop_order)
      const s = stats.get(row.id)
      return {
        ...summary(row),
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

  /** One trail with everything the detail page needs, or null if it doesn't exist or isn't visible. */
  async get(id: string, user: AuthUser | null): Promise<TrailDetail | null> {
    const db = this.clients.forUser(user)
    const { data: row, error } = await db.from('sidequests').select(DETAIL_SELECT).eq('id', id).returns<DetailRow[]>().maybeSingle()
    if (error) throw error
    if (!row) return null

    const stats = (await this.ratingStats(db, [row.id])).get(row.id)
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
        crumbs: crumbs.filter((crumb) => crumb.stopId === stop.id),
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
      ...summary(row),
      status: row.status as SidequestStatus,
      visibility: row.visibility as TrailVisibility,
      communityId: row.community_id,
      remixedFrom: row.remixed_from ? await this.remixSource(db, row.remixed_from) : null,
      stopCount: stops.length,
      crumbCount: crumbs.length,
      firstStopName: stops[0]?.placeName ?? null,
      lastStopName: stops.length > 1 ? stops[stops.length - 1].placeName : null,
      stops,
      betweenStopCrumbs: crumbs.filter((crumb) => crumb.stopId === null),
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

  /** Rating stats for many trails at once, keyed by trail id. */
  private async ratingStats(db: SupabaseClient, ids: string[]): Promise<Map<string, RatingStatsRow>> {
    const stats = new Map<string, RatingStatsRow>()
    if (ids.length === 0) return stats
    const { data, error } = await db.from('sidequest_rating_stats').select('*').in('sidequest_id', ids).returns<RatingStatsRow[]>()
    if (error) throw error
    for (const row of data ?? []) if (row.sidequest_id) stats.set(row.sidequest_id, row)
    return stats
  }

  /** The original a remix was copied from, if the caller can still see it; failures just hide the credit. */
  private async remixSource(db: SupabaseClient, id: string): Promise<TrailRemixSource | null> {
    const { data, error } = await db
      .from('sidequests')
      .select(`id, title, creator:profiles!sidequests_creator_id_fkey(${CREATOR_FIELDS})`)
      .eq('id', id)
      .returns<{ id: string; title: string; creator: TrailCreator | null }[]>()
      .maybeSingle()
    return error || !data ? null : { id: data.id, title: data.title, creator: data.creator }
  }
}

function summary(row: SummaryRow) {
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
  }
}
