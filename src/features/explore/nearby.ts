/**
 * Sorting for Explore's Nearby tab: each trail's distance from the user to its
 * first stop with coordinates (MapTrail.start), nearest first. Trails without a
 * located stop go last, in their original order. Pure functions; the position
 * is passed in and never kept. Used by NearbyPanel.tsx (task G7).
 * Also the radius filter's steps (RadiusSlider, Explore's ?radius=).
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

/** The radius slider's stops, in miles (past the last one is "Any distance"). */
export const RADIUS_STEPS = [0.5, 1, 2, 3, 5, 10]

/** ?radius= → one of the steps, or null for any distance. */
export function parseRadius(value: string | null): number | null {
  const miles = Number(value)
  return value && RADIUS_STEPS.includes(miles) ? miles : null
}

export function radiusLabel(miles: number | null) {
  if (miles === null) return 'Any distance'
  return `Within ${miles === 0.5 ? '½' : miles} mi`
}

/** Trails whose first stop is within `miles` (trails without a location are left out). No radius: all. */
export function withinRadius(trails: NearbyTrail[], miles: number | null): NearbyTrail[] {
  if (miles === null) return trails
  return trails.filter((t) => t.distanceMiles !== undefined && t.distanceMiles <= miles)
}
