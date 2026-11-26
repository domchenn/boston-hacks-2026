/**
 * Finding people to follow, for the Explore Friends tab's "Find people" box:
 * - searchPeople: people whose @username or name contains the search.
 * - suggestPeopleToFollow: people who follow you that you don't follow back
 *   first, then people who've made published trails, then recent members.
 * Profiles and follows are public tables, so plain queries are enough.
 */

import type { TrailCreator } from '@/lib/api/trails'
import { supabase } from '@/lib/supabase'

/** supabase-js reports network failures without a Postgres code. */
function friendlyError(error: { code?: string; message?: string } | null) {
  if (error && !error.code && /fetch|network/i.test(error.message ?? '')) {
    return new Error('No connection. Check your internet and try again.')
  }
  return new Error('Something went wrong loading this. Please try again.')
}

const PERSON_FIELDS = 'id, username, display_name, avatar_url'

/** People whose @username or name contains `query` (you excluded), up to `limit`. */
export async function searchPeople(viewerId: string, query: string, limit = 8): Promise<TrailCreator[]> {
  // Keep only characters that are safe inside a PostgREST or() filter.
  const q = query.trim().replace(/^@/, '').replace(/[^\p{L}\p{N} _.'-]/gu, '').slice(0, 40)
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('profiles')
    .select(PERSON_FIELDS)
    .not('username', 'is', null)
    .neq('id', viewerId)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .order('username')
    .limit(limit)
  if (error) throw friendlyError(error)
  return data ?? []
}

/**
 * Up to `limit` people to follow, minus you and the people you already follow:
 * first people who follow you (to follow back), then people who've made
 * published trails, then other recent members. Each has a username (for a profile link).
 */
export async function suggestPeopleToFollow(viewerId: string, limit = 6): Promise<TrailCreator[]> {
  const [makers, follows, followers, recent] = await Promise.all([
    supabase
      .from('sidequests')
      .select(`creator:profiles!sidequests_creator_id_fkey(${PERSON_FIELDS})`)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('follows').select('following_id').eq('follower_id', viewerId),
    supabase.from('follows').select(`person:profiles!follows_follower_id_fkey(${PERSON_FIELDS})`).eq('following_id', viewerId),
    supabase
      .from('profiles')
      .select(PERSON_FIELDS)
      .not('username', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  if (makers.error) throw friendlyError(makers.error)
  const skip = new Set([viewerId, ...(follows.data ?? []).map((f) => f.following_id)])
  const people = new Map<string, TrailCreator>()
  const candidates = [
    ...(followers.data ?? []).map((r) => r.person),
    ...(makers.data ?? []).map((r) => r.creator),
    ...(recent.data ?? []),
  ]
  for (const person of candidates) {
    if (person?.username && !skip.has(person.id) && !people.has(person.id)) people.set(person.id, person)
  }
  return [...people.values()].slice(0, limit)
}
