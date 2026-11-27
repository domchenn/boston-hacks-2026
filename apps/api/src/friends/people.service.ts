/**
 * Friends' activity, "you both saved this", trail cards by id, people search and
 * suggestions (M15c), ported from the web's features/friends/api.ts, alsoSaved.ts
 * and findPeopleApi.ts with the same queries, run as the caller:
 * - friends_activity() and friends_also_saved() are SECURITY DEFINER functions that
 *   return only what the caller may know (signed-in only, by their grants);
 * - trail cards come from plain RLS queries, so trails hidden from the caller are
 *   left out, and activity items for them are dropped.
 */
import { Injectable } from '@nestjs/common'
import type { ActivityItem, FriendsActivity, TrailCard, TrailCreator } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { num, type Numeric } from '../common/numeric.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

const PERSON = 'id, username, display_name, avatar_url'
const CARD_COLUMNS = `id, title, category, custom_category, neighborhood, estimated_cost, estimated_duration_minutes, scheduled_at,
  sidequest_stops(place_name, stop_order), creator:profiles!sidequests_creator_id_fkey(username)`

type CardRow = {
  id: string
  title: string
  category: TrailCard['category']
  custom_category: string | null
  neighborhood: string | null
  estimated_cost: Numeric
  estimated_duration_minutes: number | null
  scheduled_at: string | null
  sidequest_stops: { place_name: string; stop_order: number }[]
  creator: { username: string | null } | null
}
type StatsRow = { sidequest_id: string; avg_overall: Numeric; rating_count: number | null }
type ActivityRow = {
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  kind: string
  sidequest_id: string
  happened_at: string
}
type AlsoSavedRow = { sidequest_id: string; friend_id: string; username: string | null; display_name: string | null; avatar_url: string | null }

function fail(error: { code?: string; message?: string }): never {
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class PeopleService {
  constructor(private readonly clients: SupabaseClients) {}

  /** Cards for these trails, in the order given; ones the caller can't see are left out. */
  async cards(ids: string[], user: AuthUser | null): Promise<TrailCard[]> {
    if (ids.length === 0) return []
    const db = this.clients.forUser(user)
    const [cards, stats] = await Promise.all([
      db.from('sidequests').select(CARD_COLUMNS).in('id', ids).returns<CardRow[]>(),
      db.from('sidequest_rating_stats').select('sidequest_id, avg_overall, rating_count').in('sidequest_id', ids).returns<StatsRow[]>(),
    ])
    if (cards.error) fail(cards.error)
    // Ratings are decoration, as on the web: a failed stats read just shows no rating.
    const ratings = new Map((stats.data ?? []).map((s) => [s.sidequest_id, s]))
    const byId = new Map(
      cards.data.map((row) => {
        const stops = [...row.sidequest_stops].sort((a, b) => a.stop_order - b.stop_order)
        const r = ratings.get(row.id)
        const card: TrailCard = {
          id: row.id,
          title: row.title,
          category: row.category,
          customCategory: row.custom_category,
          neighborhood: row.neighborhood,
          estimatedCost: num(row.estimated_cost),
          estimatedMinutes: row.estimated_duration_minutes,
          scheduledAt: row.scheduled_at,
          stopCount: stops.length,
          firstStopName: stops[0]?.place_name ?? null,
          lastStopName: stops.length > 1 ? stops[stops.length - 1]!.place_name : null,
          rating: { average: num(r?.avg_overall), count: r?.rating_count ?? 0 },
          creator: row.creator,
        }
        return [row.id, card] as const
      }),
    )
    return [...new Set(ids)].flatMap((id) => byId.get(id) ?? [])
  }

  /** What the people you follow made or finished, newest first, with their cards. */
  async activity(limit: number, user: AuthUser): Promise<FriendsActivity> {
    const { data, error } = await this.clients.forUser(user).rpc('friends_activity', { p_limit: limit })
    if (error) fail(error)
    // Joining dated trails was removed from the app, so old "joined" items are skipped (as on the web).
    const rows = ((data ?? []) as ActivityRow[]).filter((r) => r.kind === 'made' || r.kind === 'finished')
    const trails = await this.cards([...new Set(rows.map((r) => r.sidequest_id))], user)
    const visible = new Set(trails.map((t) => t.id))
    const items = rows
      .filter((r) => visible.has(r.sidequest_id))
      .map<ActivityItem>((r) => ({
        person: { id: r.user_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
        kind: r.kind as ActivityItem['kind'],
        trailId: r.sidequest_id,
        at: r.happened_at,
      }))
    return { items, trails }
  }

  /** One entry per (trail, friend) both of you saved, newest save first. */
  async alsoSaved(user: AuthUser): Promise<{ trailId: string; friend: TrailCreator }[]> {
    const { data, error } = await this.clients.forUser(user).rpc('friends_also_saved')
    if (error) fail(error)
    return ((data ?? []) as AlsoSavedRow[]).map((row) => ({
      trailId: row.sidequest_id,
      friend: { id: row.friend_id, username: row.username, display_name: row.display_name, avatar_url: row.avatar_url },
    }))
  }

  /** People whose @username or name contains `query` (not you), A to Z by username. */
  async search(query: string, limit: number, user: AuthUser): Promise<TrailCreator[]> {
    // Keep only characters that are safe inside a PostgREST or() filter.
    const q = query.trim().replace(/^@/, '').replace(/[^\p{L}\p{N} _.'-]/gu, '').slice(0, 40)
    if (q.length < 2) return []
    const { data, error } = await this.clients
      .forUser(user)
      .from('profiles')
      .select(PERSON)
      .not('username', 'is', null)
      .neq('id', user.id)
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .order('username')
      .limit(limit)
      .returns<TrailCreator[]>()
    if (error) fail(error)
    return data
  }

  /**
   * People to follow, minus you and the people you already follow: first people who
   * follow you, then people who made published trails, then recent members. Each has
   * a username (for a profile link).
   */
  async suggestions(limit: number, user: AuthUser): Promise<TrailCreator[]> {
    const db = this.clients.forUser(user)
    const [makers, follows, followers, recent] = await Promise.all([
      db
        .from('sidequests')
        .select(`creator:profiles!sidequests_creator_id_fkey(${PERSON})`)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<{ creator: TrailCreator | null }[]>(),
      db.from('follows').select('following_id').eq('follower_id', user.id).returns<{ following_id: string }[]>(),
      db
        .from('follows')
        .select(`person:profiles!follows_follower_id_fkey(${PERSON})`)
        .eq('following_id', user.id)
        .returns<{ person: TrailCreator | null }[]>(),
      db.from('profiles').select(PERSON).not('username', 'is', null).order('created_at', { ascending: false }).limit(30).returns<TrailCreator[]>(),
    ])
    if (makers.error) fail(makers.error)
    const skip = new Set([user.id, ...(follows.data ?? []).map((f) => f.following_id)])
    const people = new Map<string, TrailCreator>()
    const candidates = [...(followers.data ?? []).map((r) => r.person), ...makers.data.map((r) => r.creator), ...(recent.data ?? [])]
    for (const person of candidates) {
      if (person?.username && !skip.has(person.id) && !people.has(person.id)) people.set(person.id, person)
    }
    return [...people.values()].slice(0, limit)
  }
}
