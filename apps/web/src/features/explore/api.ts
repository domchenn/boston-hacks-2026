/**
 * Trails for Explore and the Map tab: the published feed from getFeed() (category,
 * neighborhood, cost, length and late-night filters), each trail's start (its first
 * stop with coordinates) for the map pins, and the "Near a T station" filter, which
 * checks every stop against MBTA rapid-transit stations from @/lib/mbta (straight-line
 * distance). Also the neighborhood list for the filter, and the Trending tab's
 * ranking (loadTrending). Used by ExplorePage and MapPage. With VITE_API_URL set, the
 * neighborhood list and Trending come from the API (GET /v1/neighborhoods, /v1/trending).
 */

import { getFeed, type FeedFilters, type FeedTrail } from '@/lib/api/trails'
import { getApi } from '@/lib/apiClient'
import { loadStations, milesBetween } from '@/lib/mbta'
import { supabase } from '@/lib/supabase'

export type { FeedFilters, FeedTrail }

/** A feed trail plus where it starts. `start` is null when no stop has coordinates. */
export type MapTrail = FeedTrail & { start: { lat: number; lng: number } | null }

export type ExploreFilters = FeedFilters & {
  /** Only trails where every stop is within NEAR_T_MILES of a T station. */
  nearT?: boolean
}

/** "Near a T station": about a 10-minute walk, as the crow flies. */
export const NEAR_T_MILES = 0.5

/** Shown when the MBTA station list can't be loaded for the Near a T station filter. */
export const STATIONS_ERROR = "Couldn't check T stations right now. Try again, or turn off Near a T station."

function startOf(trail: FeedTrail): MapTrail['start'] {
  const first = trail.places?.find((p) => p.latitude !== null && p.longitude !== null)
  return first ? { lat: first.latitude!, lng: first.longitude! } : null
}

/** True when the trail has stops and every one of them is near a station. Stops without coordinates can't be checked, so they fail. */
function allStopsNearT(trail: FeedTrail, stations: Awaited<ReturnType<typeof loadStations>>) {
  const places = trail.places ?? []
  return (
    places.length > 0 &&
    places.every(
      (p) =>
        p.latitude !== null &&
        p.longitude !== null &&
        stations.some((s) => milesBetween({ latitude: p.latitude!, longitude: p.longitude! }, s) <= NEAR_T_MILES),
    )
  )
}

/** Published trails (newest first, filtered like getFeed, plus Near a T station) with their start positions. */
export async function loadTrails({ nearT, ...filters }: ExploreFilters = {}): Promise<MapTrail[]> {
  const [trails, stations] = await Promise.all([
    getFeed(filters),
    nearT
      ? loadStations().catch(() => {
          throw new Error(STATIONS_ERROR)
        })
      : null,
  ])
  return trails
    .filter((trail) => !stations || allStopsNearT(trail, stations))
    .map((trail) => ({ ...trail, start: startOf(trail) }))
}

/** Neighborhoods that have at least one published trail, A to Z, for the filter. */
export async function loadNeighborhoods(): Promise<string[]> {
  const api = getApi()
  if (api) return (await api).getNeighborhoods()
  const { data, error } = await supabase
    .from('sidequests')
    .select('neighborhood')
    .eq('status', 'published')
    .not('neighborhood', 'is', null)
  if (error) throw error
  const names = new Set((data ?? []).map((row) => row.neighborhood?.trim()).filter((n): n is string => Boolean(n)))
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** Matches the header search (?q=) against a trail's title, description, neighborhood and every stop name. */
export function matchesSearch(trail: FeedTrail, q: string) {
  const needle = q.toLowerCase()
  const stopNames = trail.places?.map((p) => p.name) ?? [trail.firstStopName, trail.lastStopName]
  return [trail.title, trail.description, trail.neighborhood, ...stopNames].some((field) =>
    field?.toLowerCase().includes(needle),
  )
}

/** One trending trail: its rank score and how many different people were active on it lately. */
export type TrendingEntry = { id: string; score: number; people: number }

/** How far back Trending looks, in days. */
export const TRENDING_DAYS = 14

/** Trails with the most recent activity (trending_trails(): totals only, never who), busiest first. */
export async function loadTrending(limit = 30): Promise<TrendingEntry[]> {
  const api = getApi()
  if (api) {
    const trails = await (await api).getTrending({ days: TRENDING_DAYS, limit })
    return trails.map((t) => ({ id: t.trailId, score: t.score, people: t.people }))
  }
  const { data, error } = await supabase.rpc('trending_trails', { p_days: TRENDING_DAYS, p_limit: limit })
  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.sidequest_id, score: row.score, people: row.people }))
}
