/**
 * Friends (task J7): following people and what they've been up to.
 *
 * - Follows (public table, RLS: you can only follow / unfollow as yourself):
 *   getFollowCounts, isFollowing, follow, unfollow.
 * - Activity: friends_activity() (a SECURITY DEFINER function, since finishing or
 *   joining a trail is private progress) returns the made / finished / joined
 *   trails of the people you follow, newest first. loadFriendsActivity adds each
 *   trail's card details (only trails you can see come back, by RLS).
 * - suggestPeople: trail makers you don't follow yet, for the empty Friends tab.
 * - Friends and privacy: friends are people who follow each other
 *   (getRelationship, getFriends); a private account's trails are only visible
 *   to friends (setPrivateAccount); close friends lists for close-friends-only
 *   trails (getCloseFriendIds, setCloseFriend). Enforced by RLS (migration
 *   add_trail_visibility_and_close_friends).
 *
 * Used by FollowBar (profiles), PrivacySettings and FriendsActivity (You page) and the Explore
 * Friends tab (src/features/explore/FriendsPanel.tsx).
 */

import type { TrailCardData } from '@/components/TrailCard'
import type { TrailCreator } from '@/lib/api/trails'
import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/db-values'

export type ActivityKind = 'made' | 'finished' | 'joined'

export type ActivityItem = {
  person: TrailCreator
  kind: ActivityKind
  trailId: string
  /** When they made, finished or joined it (ISO). */
  at: string
}

export type FriendsActivity = {
  items: ActivityItem[]
  /** Card details for every trail in `items`, keyed by id. */
  trails: Map<string, TrailCardData>
}

/** supabase-js reports network failures without a Postgres code. */
function friendlyError(error: { code?: string; message?: string } | null) {
  if (error && !error.code && /fetch|network/i.test(error.message ?? '')) {
    return new Error('No connection. Check your internet and try again.')
  }
  return new Error('Something went wrong loading this. Please try again.')
}

/** Numeric columns can arrive as strings; normalise to number | null. */
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v))

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

/** How many people follow this user, and how many they follow. */
export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  if (followers.error || following.error) throw friendlyError(followers.error ?? following.error)
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

/** Whether `viewerId` follows `userId`. */
export async function isFollowing(viewerId: string, userId: string) {
  const { count, error } = await supabase
    .from('follows')
    .select('following_id', { count: 'exact', head: true })
    .eq('follower_id', viewerId)
    .eq('following_id', userId)
  if (error) throw friendlyError(error)
  return (count ?? 0) > 0
}

export async function follow(viewerId: string, userId: string) {
  const { error } = await supabase.from('follows').insert({ follower_id: viewerId, following_id: userId })
  // Already following (e.g. a second tab) counts as done.
  if (error && error.code !== '23505') throw friendlyError(error)
}

export async function unfollow(viewerId: string, userId: string) {
  const { error } = await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', userId)
  if (error) throw friendlyError(error)
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

const CARD_COLUMNS = `id, title, category, neighborhood, estimated_cost, estimated_duration_minutes, scheduled_at,
  sidequest_stops(place_name, stop_order)`

/** Card details (and ratings) for these trails, keyed by id. Trails you can't see are left out. */
async function loadCards(ids: string[]) {
  const cards = new Map<string, TrailCardData>()
  if (ids.length === 0) return cards
  const [{ data, error }, stats] = await Promise.all([
    supabase.from('sidequests').select(CARD_COLUMNS).in('id', ids),
    supabase.from('sidequest_rating_stats').select('sidequest_id, avg_overall, rating_count').in('sidequest_id', ids),
  ])
  if (error) throw friendlyError(error)
  const ratings = new Map((stats.data ?? []).map((s) => [s.sidequest_id, s]))
  for (const row of data ?? []) {
    const stops = [...row.sidequest_stops].sort((a, b) => a.stop_order - b.stop_order)
    const r = ratings.get(row.id)
    cards.set(row.id, {
      id: row.id,
      title: row.title,
      category: row.category as Category | null,
      neighborhood: row.neighborhood,
      estimatedCost: num(row.estimated_cost),
      estimatedMinutes: row.estimated_duration_minutes,
      scheduledAt: row.scheduled_at,
      stopCount: stops.length,
      firstStopName: stops[0]?.place_name ?? null,
      lastStopName: stops.length > 1 ? stops[stops.length - 1].place_name : null,
      rating: { average: num(r?.avg_overall), count: r?.rating_count ?? 0 },
    })
  }
  return cards
}

/** What the people you follow made, finished or joined, newest first (at most `limit` items). */
export async function loadFriendsActivity(limit = 30): Promise<FriendsActivity> {
  const { data, error } = await supabase.rpc('friends_activity', { p_limit: limit })
  if (error) throw friendlyError(error)
  const rows = data ?? []
  const trails = await loadCards([...new Set(rows.map((r) => r.sidequest_id))])
  const items = rows
    .filter((r) => trails.has(r.sidequest_id))
    .map<ActivityItem>((r) => ({
      person: { id: r.user_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
      kind: r.kind as ActivityKind,
      trailId: r.sidequest_id,
      at: r.happened_at,
    }))
  return { items, trails }
}

/** How many people `viewerId` follows (0 means show the "follow people" nudge). */
export async function countFollowing(viewerId: string) {
  return (await getFollowCounts(viewerId)).following
}

/** Up to `limit` people who've made published trails, minus you and the people you already follow. */
export async function suggestPeople(viewerId: string, limit = 5): Promise<TrailCreator[]> {
  const [{ data, error }, follows] = await Promise.all([
    supabase
      .from('sidequests')
      .select('creator:profiles!sidequests_creator_id_fkey(id, username, display_name, avatar_url)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('follows').select('following_id').eq('follower_id', viewerId),
  ])
  if (error) throw friendlyError(error)
  const skip = new Set([viewerId, ...(follows.data ?? []).map((f) => f.following_id)])
  const people = new Map<string, TrailCreator>()
  for (const row of data ?? []) {
    const person = row.creator
    // A profile link needs a username.
    if (person?.username && !skip.has(person.id) && !people.has(person.id)) people.set(person.id, person)
  }
  return [...people.values()].slice(0, limit)
}

// ---------------------------------------------------------------------------
// Friends (mutual follows), private accounts and close friends
// ---------------------------------------------------------------------------

/** How two people are connected: friends = they follow each other. */
export type Relationship = { following: boolean; followsYou: boolean }

export async function getRelationship(viewerId: string, userId: string): Promise<Relationship> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, following_id')
    .or(
      `and(follower_id.eq.${viewerId},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${viewerId})`,
    )
  if (error) throw friendlyError(error)
  const rows = data ?? []
  return {
    following: rows.some((r) => r.follower_id === viewerId),
    followsYou: rows.some((r) => r.follower_id === userId),
  }
}

/** Your friends (people you follow who follow you back), A to Z by name. */
export async function getFriends(viewerId: string): Promise<TrailCreator[]> {
  const [mine, theirs] = await Promise.all([
    supabase
      .from('follows')
      .select('person:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)')
      .eq('follower_id', viewerId),
    supabase.from('follows').select('follower_id').eq('following_id', viewerId),
  ])
  if (mine.error || theirs.error) throw friendlyError(mine.error ?? theirs.error)
  const followers = new Set((theirs.data ?? []).map((r) => r.follower_id))
  return (mine.data ?? [])
    .map((r) => r.person)
    .filter((p): p is TrailCreator => p !== null && followers.has(p.id))
    .sort((a, b) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || ''))
}

/** Ids on your close friends list (only you can read it). */
export async function getCloseFriendIds(viewerId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('close_friends').select('friend_id').eq('owner_id', viewerId)
  if (error) throw friendlyError(error)
  return new Set((data ?? []).map((r) => r.friend_id))
}

export async function setCloseFriend(viewerId: string, friendId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('close_friends').insert({ owner_id: viewerId, friend_id: friendId })
    : await supabase.from('close_friends').delete().eq('owner_id', viewerId).eq('friend_id', friendId)
  // Already on the list counts as done; 42501 = they aren't a friend (anymore).
  if (error?.code === '42501') throw new Error('Only friends (people who follow you back) can be close friends.')
  if (error && error.code !== '23505') throw friendlyError(error)
}

/** Make your account private (trails only visible to friends) or public. */
export async function setPrivateAccount(viewerId: string, isPrivate: boolean) {
  const { error } = await supabase.from('profiles').update({ is_private: isPrivate }).eq('id', viewerId)
  if (error) throw friendlyError(error)
}
