/**
 * Sorting for Explore's Nearby tab: each trail's distance from the user to its
 * first stop with coordinates (MapTrail.start), nearest first. Trails without a
 * located stop go last, in their original order. Pure functions; the position
 * is passed in and never kept. Used by NearbyPanel.tsx (task G7).
 */
import { milesBetween } from '@/lib/mbta'
import type { MapTrail } from './api'

export type Position = { latitude: number; longitude: number }
export type NearbyTrail = MapTrail & { distanceMiles?: number }

export function sortByDistance(trails: MapTrail[], here: Position): NearbyTrail[] {
  const located: NearbyTrail[] = []
  const unlocated: NearbyTrail[] = []
  for (const trail of trails) {
    if (trail.start) {
      located.push({ ...trail, distanceMiles: milesBetween(here, { latitude: trail.start.lat, longitude: trail.start.lng }) })
    } else {
      unlocated.push(trail)
    }
  }
  // Array sort is stable, so equal distances keep the feed's order.
  located.sort((a, b) => a.distanceMiles! - b.distanceMiles!)
  return [...located, ...unlocated]
}
