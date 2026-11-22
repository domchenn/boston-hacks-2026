/**
 * "Open in Google Maps" link to one stop, for the Active trail page. Uses Google's
 * documented Maps URLs (https://developers.google.com/maps/documentation/urls).
 * No origin is set, so Google routes from the phone's own location: the app never
 * sends the user's position. Transit-first: walk/bike legs use those modes, and
 * everything else (T, bus, or getting to the first stop) uses transit. Never driving.
 *
 * Swap for getDirectionsLink() from src/lib/maps.ts once task D3 lands.
 */
import type { TrailStop } from '@/lib/api/trails'

const TRAVEL_MODE = { walk: 'walking', bike: 'bicycling', train: 'transit', bus: 'transit' } as const

export function directionsLink(stop: Pick<TrailStop, 'placeName' | 'address' | 'latitude' | 'longitude' | 'travelModeToStop'>) {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  const destination =
    stop.latitude !== null && stop.longitude !== null
      ? `${stop.latitude},${stop.longitude}`
      : [stop.placeName, stop.address, 'Boston, MA'].filter(Boolean).join(', ')
  url.searchParams.set('destination', destination)
  url.searchParams.set('travelmode', stop.travelModeToStop ? TRAVEL_MODE[stop.travelModeToStop] : 'transit')
  return url.toString()
}
