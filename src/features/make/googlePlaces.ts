/**
 * Google place search for Make a trail's "Add a place" box, so any real place can
 * be a stop, not just the curated library. Uses the Places API (New) through the
 * Maps JavaScript API: AutocompleteSuggestion while you type (biased to Boston),
 * then Place.fetchFields for the name, address, coordinates and neighborhood of
 * the one you pick. Needs "Places API (New)" enabled for VITE_GOOGLE_MAPS_API_KEY;
 * without it (or with no key) searchPlaces returns [] and the picker still offers
 * library places, your own place and pasted coordinates.
 * Also parses typed coordinates ("42.3554, -71.0765") for a dropped pin.
 */

import { loadGoogleMaps } from '@/lib/maps'

export type PlaceSuggestion = {
  /** Google's place prediction, kept to fetch details when picked. */
  prediction: google.maps.places.PlacePrediction
  name: string
  detail: string
}

export type FoundPlace = {
  name: string
  address: string
  latitude: number
  longitude: number
  neighborhood: string | null
}

/** Boston, about 30 km around: results nearby come first, but anywhere still works. */
const BOSTON_BIAS = { center: { lat: 42.3601, lng: -71.0589 }, radius: 30000 }

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

/** Suggestions for what's typed, or [] if Google place search isn't available. */
export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
  try {
    const maps = await loadGoogleMaps()
    const { AutocompleteSuggestion, AutocompleteSessionToken } = (await maps.importLibrary(
      'places',
    )) as google.maps.PlacesLibrary
    // One token per search session (typing until a pick), as Google asks.
    sessionToken ??= new AutocompleteSessionToken()
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      locationBias: BOSTON_BIAS,
      includedRegionCodes: ['us'],
      sessionToken,
    })
    return suggestions
      .map((s) => s.placePrediction)
      .filter((p): p is google.maps.places.PlacePrediction => p !== null)
      .slice(0, 5)
      .map((prediction) => ({
        prediction,
        name: prediction.mainText?.text ?? prediction.text.text,
        detail: (prediction.secondaryText?.text ?? '').replace(/, USA$/, ''),
      }))
  } catch {
    return []
  }
}

/** Name, address, coordinates and neighborhood of a picked suggestion, or null if Google fails. */
export async function placeDetails(suggestion: PlaceSuggestion): Promise<FoundPlace | null> {
  try {
    const place = suggestion.prediction.toPlace()
    await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'] })
    sessionToken = null // the pick ends this search session
    const location = place.location
    if (!location) return null
    const part = (type: string) => place.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null
    return {
      name: place.displayName || suggestion.name,
      address: (place.formattedAddress ?? '').replace(/, USA$/, ''),
      latitude: location.lat(),
      longitude: location.lng(),
      neighborhood: part('neighborhood') ?? part('sublocality_level_1') ?? part('locality'),
    }
  } catch {
    return null
  }
}

/** "42.3554, -71.0765" (or with a space instead of the comma) → coordinates, else null. */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const match = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!match) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
