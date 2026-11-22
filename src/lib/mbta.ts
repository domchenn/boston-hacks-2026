/**
 * MBTA rapid-transit stations (Red, Orange, Blue, Green, Mattapan) from the
 * public MBTA V3 API, and the closest ones to a point.
 *
 * Loads each line's stations once per browser session (8 small requests, then
 * cached in sessionStorage), so it stays under the 20 requests/minute limit
 * without a key. Set VITE_MBTA_API_KEY for a higher limit. Distances are
 * straight-line ("as the crow flies"); no walking times are invented.
 */

export type TLine = 'Red' | 'Orange' | 'Blue' | 'Green' | 'Mattapan'

export type Station = {
  id: string
  name: string
  latitude: number
  longitude: number
  lines: TLine[]
  /** Green Line branches serving it, e.g. ["B", "C"]. */
  greenBranches: string[]
}

export type NearbyStation = Station & { miles: number }

const ROUTES = ['Red', 'Mattapan', 'Orange', 'Blue', 'Green-B', 'Green-C', 'Green-D', 'Green-E'] as const
const API = 'https://api-v3.mbta.com'
const API_KEY = import.meta.env.VITE_MBTA_API_KEY ?? ''
const CACHE_KEY = 'breadcrumb:mbta-stations:v1'

/** Official line colors (from the MBTA API), used for the line pills. */
export const LINE_COLORS: Record<TLine, string> = {
  Red: '#DA291C',
  Mattapan: '#DA291C',
  Orange: '#ED8B00',
  Blue: '#003DA5',
  Green: '#00843D',
}

type StopsResponse = { data: { id: string; attributes: { name: string; latitude: number; longitude: number } }[] }

let stationsPromise: Promise<Station[]> | null = null

async function fetchRouteStops(route: (typeof ROUTES)[number]) {
  const params = new URLSearchParams({ 'filter[route]': route, 'fields[stop]': 'name,latitude,longitude' })
  const res = await fetch(`${API}/stops?${params}`, { headers: API_KEY ? { 'x-api-key': API_KEY } : {} })
  if (!res.ok) throw new Error(`MBTA API ${res.status}`)
  return ((await res.json()) as StopsResponse).data
}

/** Every rapid-transit station with the lines that serve it (cached per session). */
export function loadStations(): Promise<Station[]> {
  if (stationsPromise) return stationsPromise
  stationsPromise = (async () => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) return JSON.parse(cached) as Station[]
    } catch {
      // storage unavailable: just fetch
    }
    const byId = new Map<string, Station>()
    const results = await Promise.all(ROUTES.map(async (route) => ({ route, stops: await fetchRouteStops(route) })))
    for (const { route, stops } of results) {
      const line: TLine = route.startsWith('Green') ? 'Green' : (route as TLine)
      for (const stop of stops) {
        const station =
          byId.get(stop.id) ??
          ({
            id: stop.id,
            name: stop.attributes.name,
            latitude: stop.attributes.latitude,
            longitude: stop.attributes.longitude,
            lines: [],
            greenBranches: [],
          } satisfies Station)
        if (!station.lines.includes(line)) station.lines.push(line)
        if (route.startsWith('Green-')) station.greenBranches.push(route.slice(6))
        byId.set(stop.id, station)
      }
    }
    const stations = [...byId.values()]
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(stations))
    } catch {
      // ignore
    }
    return stations
  })().catch((error) => {
    stationsPromise = null // allow a retry later
    throw error
  })
  return stationsPromise
}

/** Straight-line distance in miles (haversine). */
export function milesBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

/** The closest stations to a point, nearest first, within `maxMiles`. */
export function nearestStations(
  stations: Station[],
  point: { latitude: number; longitude: number },
  { limit = 2, maxMiles = 0.75 }: { limit?: number; maxMiles?: number } = {},
): NearbyStation[] {
  return stations
    .map((s) => ({ ...s, miles: milesBetween(point, s) }))
    .filter((s) => s.miles <= maxMiles)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit)
}
