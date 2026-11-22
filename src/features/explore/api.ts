/**
 * Trails for Explore and the Map tab: the published feed from getFeed() plus each
 * trail's start (its first stop with coordinates) for the map pins. The starts
 * come from one extra sidequest_stops query; if that fails the cards still load
 * and the map just shows no pins. Used by ExplorePage and MapPage.
 */

import { getFeed, type FeedFilters, type FeedTrail } from '@/lib/api/trails'
import { supabase } from '@/lib/supabase'

export type { FeedFilters, FeedTrail }

/** A feed trail plus where it starts. `start` is null when no stop has coordinates. */
export type MapTrail = FeedTrail & { start: { lat: number; lng: number } | null }

/** Each trail's first stop that has coordinates, keyed by trail id. */
async function fetchStarts(trailIds: string[]) {
  const starts = new Map<string, { order: number; lat: number; lng: number }>()
  if (trailIds.length === 0) return starts
  const { data, error } = await supabase
    .from('sidequest_stops')
    .select('sidequest_id, stop_order, latitude, longitude')
    .in('sidequest_id', trailIds)
  if (error) throw error
  for (const stop of data ?? []) {
    if (stop.latitude == null || stop.longitude == null) continue
    const current = starts.get(stop.sidequest_id)
    if (!current || stop.stop_order < current.order) {
      starts.set(stop.sidequest_id, { order: stop.stop_order, lat: stop.latitude, lng: stop.longitude })
    }
  }
  return starts
}

/** Published trails (newest first, filtered like getFeed) with their start positions. */
export async function loadTrails(filters: FeedFilters = {}): Promise<MapTrail[]> {
  const trails = await getFeed(filters)
  const starts = await fetchStarts(trails.map((t) => t.id)).catch(() => new Map<string, { lat: number; lng: number }>())
  return trails.map((trail) => {
    const start = starts.get(trail.id)
    return { ...trail, start: start ? { lat: start.lat, lng: start.lng } : null }
  })
}

/** Matches the header search (?q=) against a trail's title, neighborhood, stop names and description. */
export function matchesSearch(trail: FeedTrail, q: string) {
  const needle = q.toLowerCase()
  return [trail.title, trail.neighborhood, trail.firstStopName, trail.lastStopName, trail.description].some((field) =>
    field?.toLowerCase().includes(needle),
  )
}
