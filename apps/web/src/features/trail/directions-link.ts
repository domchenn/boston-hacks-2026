/**
 * "Open in Google Maps" link to one stop, for the Active trail and Trail detail
 * pages. Uses Google's documented Maps URLs
 * (https://developers.google.com/maps/documentation/urls). By default no origin is
 * set, so Google routes from the phone's own location: the app never sends the
 * user's position. Pass `from` (the previous stop) for stop-to-stop directions. Transit-first: walk/bike legs use those modes, and
 * everything else (T, bus, or getting to the first stop) uses transit. Never driving.
 *
 * Swap for getDirectionsLink() from src/lib/maps.ts once task D3 lands.
 */
import type { TrailStop } from '@/lib/api/trails'

const TRAVEL_MODE = { walk: 'walking', bike: 'bicycling', train: 'transit', bus: 'transit' } as const

type Place = Pick<TrailStop, 'placeName' | 'address' | 'latitude' | 'longitude'>

/** Coordinates when known, else the name and address (Google looks it up). */
const where = (stop: Place) =>
  stop.latitude !== null && stop.longitude !== null
    ? `${stop.latitude},${stop.longitude}`
    : [stop.placeName, stop.address, 'Boston, MA'].filter(Boolean).join(', ')

export function directionsLink(stop: Place & Pick<TrailStop, 'travelModeToStop'>, from?: Place) {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  if (from) url.searchParams.set('origin', where(from))
  url.searchParams.set('destination', where(stop))
  url.searchParams.set('travelmode', stop.travelModeToStop ? TRAVEL_MODE[stop.travelModeToStop] : 'transit')
  return url.toString()
}
