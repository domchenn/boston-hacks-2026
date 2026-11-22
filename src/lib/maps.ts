/**
 * Google Maps helpers shared by every map in the app:
 * - loadGoogleMaps(): loads the Maps JavaScript API once (needs VITE_GOOGLE_MAPS_API_KEY).
 * - MAP_STYLE: the style guide's warm, quiet map style (docs/styles/map-style.json).
 * - getDirectionsLink(): "Open in Google Maps" deep links for walking / transit / biking.
 * - googleTravelMode(): our travel modes → Google's (never driving).
 */

import mapStyleJson from '../../docs/styles/map-style.json'
import type { TravelMode } from '@/types/db-values'

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
export const MAP_STYLE = mapStyleJson as google.maps.MapTypeStyle[]

/** Boston Common, for maps with nothing to show yet. */
export const BOSTON_CENTER = { lat: 42.355, lng: -71.065 }

export type LatLng = { lat: number; lng: number }

let loading: Promise<typeof google.maps> | null = null

/**
 * Loads the Maps JavaScript API once and resolves with `google.maps`.
 * Rejects if there's no API key or the script fails (callers show a fallback).
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window !== 'undefined' && window.google?.maps?.Map) return Promise.resolve(window.google.maps)
  if (loading) return loading
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error('No VITE_GOOGLE_MAPS_API_KEY set'))

  loading = new Promise((resolve, reject) => {
    const callback = '__breadcrumbMapsReady'
    ;(window as unknown as Record<string, () => void>)[callback] = () => resolve(window.google.maps)
    const script = document.createElement('script')
    const params = new URLSearchParams({ key: GOOGLE_MAPS_API_KEY, v: 'weekly', loading: 'async', callback })
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`
    script.async = true
    script.onerror = () => {
      loading = null
      reject(new Error('Google Maps failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Google's name for how to travel a leg. Bus and T both use transit. */
export function googleTravelMode(mode: TravelMode | null): 'walking' | 'transit' | 'bicycling' {
  if (mode === 'bus' || mode === 'train') return 'transit'
  if (mode === 'bike') return 'bicycling'
  return 'walking'
}

/** A place for a deep link: coordinates if we have them, otherwise a name/address to search. */
export type LinkPlace = LatLng | string

const formatPlace = (place: LinkPlace) => (typeof place === 'string' ? place : `${place.lat},${place.lng}`)

/**
 * "Open in Google Maps" link with directions. Leave `from` out to start from the
 * user's current location (what you want during an active trail).
 */
export function getDirectionsLink(to: LinkPlace, mode: TravelMode | null = 'walk', from?: LinkPlace): string {
  const params = new URLSearchParams({ api: '1', destination: formatPlace(to), travelmode: googleTravelMode(mode) })
  if (from) params.set('origin', formatPlace(from))
  return `https://www.google.com/maps/dir/?${params}`
}

/** Link to the whole trail in Google Maps: first stop → (up to 9 waypoints) → last stop, walking. */
export function getTrailDirectionsLink(places: LinkPlace[]): string | null {
  if (places.length === 0) return null
  if (places.length === 1) return getDirectionsLink(places[0])
  const params = new URLSearchParams({
    api: '1',
    origin: formatPlace(places[0]),
    destination: formatPlace(places[places.length - 1]),
    travelmode: 'walking',
  })
  const waypoints = places.slice(1, -1).slice(0, 9).map(formatPlace)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
