/**
 * Who's going on scheduled trails, through the trail_attendees() and
 * trail_going_counts() database functions (migration
 * add_trail_attendees_functions). Progress rows are private, so these only ever
 * return a count and public profile fields, and only for trails you can see.
 *
 *   getTrailAttendees(id) → { count, people }   Trail detail ("6 going" + avatars)
 *   getGoingCounts(ids)   → Map<id, count>      cards (Explore feed, Saved)
 *
 * Owner: Gio (task G5).
 */

import { supabase } from '@/lib/supabase'

export type Attendee = {
  id: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type TrailAttendees = { count: number; people: Attendee[] }

/** The first `limit` people going (earliest first) and the total. Throws the Supabase error on failure. */
export async function getTrailAttendees(trailId: string, limit = 8): Promise<TrailAttendees> {
  const { data, error } = await supabase.rpc('trail_attendees', { p_trail_id: trailId, p_limit: limit })
  if (error) throw error
  const rows = data ?? []
  return {
    count: rows[0]?.going_count ?? 0,
    // The generated types say string, but these profile fields can be null.
    people: rows.map((r) => ({
      id: r.user_id,
      username: r.username ?? null,
      displayName: r.display_name ?? null,
      avatarUrl: r.avatar_url ?? null,
    })),
  }
}

/** How many are going on each trail. Missing ids mean nobody (0). Throws on failure. */
export async function getGoingCounts(trailIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (trailIds.length === 0) return counts
  const { data, error } = await supabase.rpc('trail_going_counts', { p_trail_ids: trailIds })
  if (error) throw error
  for (const row of data ?? []) counts.set(row.sidequest_id, row.going_count)
  return counts
}

/** A scheduled trail whose start time has passed can't be joined anymore. */
export function hasHappened(scheduledAt: string | null, now = Date.now()): boolean {
  return scheduledAt !== null && new Date(scheduledAt).getTime() <= now
}
