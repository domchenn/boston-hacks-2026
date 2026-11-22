/**
 * MBTA data from the public V3 API: rapid-transit stations (Red, Orange, Blue,
 * Green, Mattapan) and the closest ones to a point, plus live next arrivals,
 * nearby bus stops and service alerts (task D7).
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

// ---------------------------------------------------------------------------
// Live data (task D7): next arrivals, nearby bus stops, service alerts.
// Only shows what the MBTA API returns; nothing is estimated or invented.
// ---------------------------------------------------------------------------

type JsonApi<T> = { data: T; included?: { type: string; id: string; attributes: Record<string, unknown> }[] }

async function mbtaGet<T>(path: string, params: Record<string, string>): Promise<JsonApi<T>> {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: API_KEY ? { 'x-api-key': API_KEY } : {},
  })
  if (!res.ok) throw new Error(`MBTA API ${res.status}`)
  return res.json() as Promise<JsonApi<T>>
}

export type Arrival = {
  /** MBTA route id, e.g. "Red", "Green-E", "43". */
  routeId: string
  /** "Red Line", "Green Line E", or a bus route number like "43". */
  routeName: string
  /** Route color from the MBTA, e.g. "#DA291C". */
  color: string
  kind: 'subway' | 'light_rail' | 'bus' | 'other'
  /** Where it's going, e.g. "Alewife". */
  headsign: string
  /** Minutes until the next arrivals (soonest first, at most 2). 0 = arriving now. */
  minutes: number[]
}

type PredictionRow = {
  attributes: { arrival_time: string | null; departure_time: string | null }
  relationships: { route: { data: { id: string } }; trip: { data: { id: string } | null } }
}

const KIND: Record<number, Arrival['kind']> = { 0: 'light_rail', 1: 'subway', 3: 'bus' }

/**
 * Next arrivals at these stops (station ids like "place-chmnl" or bus stop ids),
 * grouped by route + direction, soonest first. Arrivals more than an hour out
 * are left out.
 */
export async function getArrivals(stopIds: string[], now = Date.now()): Promise<Arrival[]> {
  if (stopIds.length === 0) return []
  const res = await mbtaGet<PredictionRow[]>('/predictions', {
    'filter[stop]': stopIds.join(','),
    include: 'route,trip',
    sort: 'arrival_time',
    'page[limit]': '60',
    'fields[prediction]': 'arrival_time,departure_time',
    'fields[route]': 'short_name,long_name,color,type',
    'fields[trip]': 'headsign',
  })
  const included = new Map((res.included ?? []).map((i) => [`${i.type}:${i.id}`, i.attributes]))
  const groups = new Map<string, Arrival>()
  for (const p of res.data) {
    const time = p.attributes.departure_time ?? p.attributes.arrival_time
    if (!time) continue
    const minutes = Math.round((new Date(time).getTime() - now) / 60000)
    if (minutes < 0 || minutes > 60) continue
    const routeId = p.relationships.route.data.id
    const route = included.get(`route:${routeId}`) ?? {}
    const trip = p.relationships.trip.data ? included.get(`trip:${p.relationships.trip.data.id}`) : undefined
    const headsign = String(trip?.headsign ?? '')
    const key = `${routeId}|${headsign}`
    const group =
      groups.get(key) ??
      ({
        routeId,
        routeName: String((route.type === 3 ? route.short_name : route.long_name) || route.short_name || routeId),
        color: `#${String(route.color ?? '888888')}`,
        kind: KIND[Number(route.type)] ?? 'other',
        headsign,
        minutes: [],
      } satisfies Arrival)
    if (group.minutes.length < 2) group.minutes.push(minutes)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => a.minutes[0] - b.minutes[0])
}

export type BusStop = { id: string; name: string; latitude: number; longitude: number; miles: number }

/** The closest bus stops to a point (within ~0.3 mi), nearest first. */
export async function getNearbyBusStops(point: { latitude: number; longitude: number }, limit = 2): Promise<BusStop[]> {
  const res = await mbtaGet<{ id: string; attributes: { name: string; latitude: number; longitude: number } }[]>('/stops', {
    'filter[latitude]': String(point.latitude),
    'filter[longitude]': String(point.longitude),
    'filter[radius]': '0.004',
    'filter[route_type]': '3',
    sort: 'distance',
    'page[limit]': String(limit),
    'fields[stop]': 'name,latitude,longitude',
  })
  return res.data.map((s) => ({ id: s.id, ...s.attributes, miles: milesBetween(point, s.attributes) }))
}

export type TransitAlert = { id: string; header: string; effect: string; severity: number }

/** Effects that only matter to some riders (elevators etc.); left out of the trail banner. */
const MINOR_EFFECTS = new Set(['ACCESS_ISSUE', 'ELEVATOR_CLOSURE', 'ESCALATOR_CLOSURE', 'FACILITY_ISSUE', 'PARKING_ISSUE', 'BIKE_ISSUE'])

/** Active service alerts affecting these stations (severity 3+), most severe first. */
export async function getAlerts(stopIds: string[]): Promise<TransitAlert[]> {
  if (stopIds.length === 0) return []
  const res = await mbtaGet<{ id: string; attributes: { header: string; effect: string; severity: number } }[]>('/alerts', {
    'filter[stop]': stopIds.join(','),
    'filter[datetime]': 'NOW',
    'fields[alert]': 'header,effect,severity',
  })
  return res.data
    .map((a) => ({ id: a.id, ...a.attributes }))
    .filter((a) => a.severity >= 3 && !MINOR_EFFECTS.has(a.effect))
    .sort((a, b) => b.severity - a.severity)
}
