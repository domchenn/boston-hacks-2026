/**
 * Profile and personal-list reads, ported from the web's features/profile/api.ts and
 * features/saved/api.ts with the same queries and mapping, returning the
 * @breadcrumb/contracts shapes. Every query runs as the caller (SupabaseClients), so
 * RLS decides visibility: profiles are public, progress rows (user_sidequests) are
 * private to their owner, and other people's drafts never come back.
 */
import { Injectable } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Category,
  MyTrailsQuery,
  ProfileStats,
  ProfileTrail,
  PublicProfile,
  SavedTrail,
  SidequestStatus,
} from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { num, type Numeric } from '../common/numeric.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, university, bio, is_private, community:communities!profiles_community_id_fkey(name, slug)'
const TRAIL_COLUMNS =
  'id, title, category, custom_category, scheduled_at, estimated_cost, estimated_duration_minutes, neighborhood, status'

type TrailRow = {
  id: string
  title: string
  category: string | null
  custom_category: string | null
  scheduled_at: string | null
  estimated_cost: Numeric
  estimated_duration_minutes: number | null
  neighborhood: string | null
  status: string
}

function toTrail(row: TrailRow, extra: Partial<ProfileTrail> = {}): ProfileTrail {
  return {
    id: row.id,
    title: row.title,
    category: row.category as Category | null,
    customCategory: row.custom_category,
    scheduledAt: row.scheduled_at,
    estimatedCost: num(row.estimated_cost),
    durationMinutes: row.estimated_duration_minutes,
    neighborhood: row.neighborhood,
    trailStatus: row.status as SidequestStatus,
    completedAt: null,
    myRating: null,
    ...extra,
  }
}

@Injectable()
export class ProfilesService {
  constructor(private readonly clients: SupabaseClients) {}

  /** A profile by id or username, or null when no one matches. */
  async getProfile(handle: string, user: AuthUser | null): Promise<PublicProfile | null> {
    const query = this.clients.forUser(user).from('profiles').select(PROFILE_COLUMNS)
    const { data, error } = await (UUID.test(handle) ? query.eq('id', handle) : query.eq('username', handle))
      .returns<PublicProfile[]>()
      .maybeSingle()
    if (error) throw error
    return data
  }

  /** Questgiver rating and made count for anyone; finished count only for your own profile. */
  async getStats(profileId: string, user: AuthUser | null): Promise<ProfileStats> {
    const db = this.clients.forUser(user)
    const [rating, made, finished] = await Promise.all([
      db
        .from('questgiver_ratings')
        .select('avg_overall, rating_count')
        .eq('creator_id', profileId)
        .returns<{ avg_overall: Numeric; rating_count: number | null }[]>()
        .maybeSingle(),
      db
        .from('sidequests')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', profileId)
        .neq('status', 'archived'),
      user?.id === profileId
        ? db
            .from('user_sidequests')
            .select('sidequest_id', { count: 'exact', head: true })
            .eq('user_id', profileId)
            .eq('status', 'completed')
        : null,
    ])
    if (rating.error) throw rating.error
    if (made.error) throw made.error
    if (finished?.error) throw finished.error

    const average = num(rating.data?.avg_overall)
    return {
      questgiverRating: rating.data?.rating_count && average !== null ? { average, count: rating.data.rating_count } : null,
      madeCount: made.count ?? 0,
      finishedCount: finished ? (finished.count ?? 0) : null,
    }
  }

  /** Trails a person made, newest first. Others see only what RLS allows; you also see drafts. */
  async getMadeTrails(profileId: string, user: AuthUser | null): Promise<ProfileTrail[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('sidequests')
      .select(TRAIL_COLUMNS)
      .eq('creator_id', profileId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .returns<TrailRow[]>()
    if (error) throw error
    return data.map((row) => toTrail(row))
  }

  /** The caller's trails with a progress status, most recent first, with their rating on finished ones. */
  async getMyTrails(status: MyTrailsQuery['status'], user: AuthUser): Promise<ProfileTrail[]> {
    const db = this.clients.forUser(user)
    const { data, error } = await db
      .from('user_sidequests')
      .select(`completed_at, updated_at, sidequest:sidequests(${TRAIL_COLUMNS})`)
      .eq('user_id', user.id)
      .eq('status', status)
      .order(status === 'completed' ? 'completed_at' : 'updated_at', { ascending: false })
      .returns<{ completed_at: string | null; updated_at: string; sidequest: TrailRow | null }[]>()
    if (error) throw error

    // A trail its creator has since hidden comes back as null; skip it.
    const trails = data.flatMap((row) => (row.sidequest ? [toTrail(row.sidequest, { completedAt: row.completed_at })] : []))
    if (status !== 'completed' || trails.length === 0) return trails

    // "You rated 4" on finished trails: your own ratings, averaged across the four scores.
    const { data: ratings, error: ratingError } = await db
      .from('sidequest_ratings')
      .select('sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating')
      .eq('user_id', user.id)
      .in(
        'sidequest_id',
        trails.map((t) => t.id),
      )
      .returns<
        { sidequest_id: string; price_rating: number; time_rating: number; enjoyment_rating: number; memorability_rating: number }[]
      >()
    if (ratingError) return trails // ratings are a nice-to-have here, as on the web
    const byTrail = new Map(
      ratings.map((r) => [r.sidequest_id, (r.price_rating + r.time_rating + r.enjoyment_rating + r.memorability_rating) / 4]),
    )
    return trails.map((t) => ({ ...t, myRating: byTrail.get(t.id) ?? null }))
  }

  /** The Saved page: the caller's saved and in-progress trails (old signed_up rows count as saved). */
  async getSavedTrails(user: AuthUser): Promise<SavedTrail[]> {
    const db = this.clients.forUser(user)
    const { data, error } = await db
      .from('user_sidequests')
      .select(
        `status, updated_at,
         sidequest:sidequests(id, title, category, custom_category, neighborhood, estimated_cost,
           estimated_duration_minutes, sidequest_stops(place_name, stop_order),
           creator:profiles!sidequests_creator_id_fkey(username))`,
      )
      .eq('user_id', user.id)
      .in('status', ['in_progress', 'signed_up', 'saved'])
      .order('updated_at', { ascending: false })
      .returns<
        {
          status: string
          updated_at: string
          sidequest: {
            id: string
            title: string
            category: string | null
            custom_category: string | null
            neighborhood: string | null
            estimated_cost: Numeric
            estimated_duration_minutes: number | null
            sidequest_stops: { place_name: string; stop_order: number }[]
            creator: { username: string | null } | null
          } | null
        }[]
      >()
    if (error) throw error

    // A trail its creator has since hidden comes back as null; skip it.
    const rows = data.flatMap((row) => (row.sidequest ? [{ ...row, sidequest: row.sidequest }] : []))
    const ratings = await this.cardRatings(
      db,
      rows.map((row) => row.sidequest.id),
    )

    return rows.map((row) => {
      const trail = row.sidequest
      const stops = [...trail.sidequest_stops].sort((a, b) => a.stop_order - b.stop_order)
      return {
        id: trail.id,
        title: trail.title,
        category: trail.category as Category | null,
        customCategory: trail.custom_category,
        neighborhood: trail.neighborhood,
        estimatedCost: num(trail.estimated_cost),
        estimatedMinutes: trail.estimated_duration_minutes,
        stopCount: stops.length,
        firstStopName: stops[0]?.place_name ?? null,
        lastStopName: stops.length > 1 ? stops[stops.length - 1].place_name : null,
        rating: ratings.get(trail.id) ?? { average: null, count: 0 },
        creator: trail.creator,
        status: row.status === 'in_progress' ? 'in_progress' : 'saved',
        updatedAt: row.updated_at,
      }
    })
  }

  /** Ratings only decorate the cards: on failure the trails still show, unrated (as on the web). */
  private async cardRatings(db: SupabaseClient, ids: string[]) {
    const ratings = new Map<string, { average: number | null; count: number }>()
    if (ids.length === 0) return ratings
    const { data, error } = await db
      .from('sidequest_rating_stats')
      .select('sidequest_id, avg_overall, rating_count')
      .in('sidequest_id', ids)
      .returns<{ sidequest_id: string | null; avg_overall: Numeric; rating_count: number | null }[]>()
    if (error) return ratings
    for (const s of data) if (s.sidequest_id) ratings.set(s.sidequest_id, { average: num(s.avg_overall), count: s.rating_count ?? 0 })
    return ratings
  }
}
