/**
 * Colors for how you get around, used for the trail dots and stop circles on
 * cards, stop lists and maps:
 *   T lines → official MBTA line colors · bus → MBTA bus yellow ·
 *   bike (Bluebikes) → blue · walking → the brand's crumb orange.
 * Change a color here and it changes everywhere.
 */

import type { TransitLine, TravelMode } from '@/types/db-values'

/** Official MBTA colors for sidequests.primary_line. */
export const T_LINE_COLORS: Record<TransitLine, string> = {
  rl: '#DA291C', // Red Line
  ol: '#ED8B00', // Orange Line
  bl: '#003DA5', // Blue Line
  gl: '#00843D', // Green Line
  sl: '#7C878E', // Silver Line
  cr: '#80276C', // Commuter Rail
}

/** Walking keeps the brand trail color (--color-crumb). */
export const WALK_COLOR = '#E8552D'
/** MBTA bus yellow, darkened a little so dots stay visible on light backgrounds. Not orange, to avoid looking like the Orange Line. */
export const BUS_COLOR = '#E5A800'
/** Bluebikes blue, lighter than the Blue Line so the two don't get confused. */
export const BIKE_COLOR = '#1E88E5'

/** Color for a trail's main T line, or null if it has none (walk/bike-only trail). */
export function lineColor(line: TransitLine | null | undefined): string | null {
  return line ? T_LINE_COLORS[line] : null
}

/**
 * Color for one leg of a trail. For T legs we only store "train", not which
 * line, so the trail's main line (primary_line) is used. Without one we'd only
 * be guessing a line, so the leg keeps the walking color.
 */
export function legColor(mode: TravelMode | null | undefined, primaryLine?: TransitLine | null): string {
  if (mode === 'train') return lineColor(primaryLine) ?? WALK_COLOR
  if (mode === 'bus') return BUS_COLOR
  if (mode === 'bike') return BIKE_COLOR
  return WALK_COLOR
}

/** Color for a transit step from Google Directions: the line's own color when Google has it. */
export function googleStepColor(step: google.maps.DirectionsStep): string {
  if (step.travel_mode === 'WALKING') return WALK_COLOR
  if (step.travel_mode === 'BICYCLING') return BIKE_COLOR
  const line = step.transit?.line
  const vehicle = line?.vehicle?.type
  if (vehicle === 'BUS' || vehicle === 'TROLLEYBUS') return BUS_COLOR
  if (line?.color) return line.color
  return WALK_COLOR
}

/** The same colors for a step from the Routes API (google.maps.routes), which replaced Directions. */
export function routesStepColor(step: google.maps.routes.RouteLegStep): string {
  if (step.travelMode === 'WALKING') return WALK_COLOR
  if (step.travelMode === 'BICYCLING') return BIKE_COLOR
  const line = step.transitDetails?.transitLine
  const vehicle = line?.vehicle?.vehicleType
  if (vehicle === 'BUS' || vehicle === 'TROLLEYBUS') return BUS_COLOR
  if (line?.color) return line.color
  return WALK_COLOR
}
