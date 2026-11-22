/**
 * Bluebikes docks near a place, with bikes and open docks available right now,
 * from the public Bluebikes GBFS feed (Lyft). The browser can call it directly
 * (CORS allowed), so no server is needed.
 *
 * Station locations load once per session; live availability is cached for
 * 60 s. Distances are straight-line. Used by StopTransit (task D7).
 */

import { milesBetween } from '@/lib/mbta'

const FEED = 'https://gbfs.lyft.com/gbfs/1.1/bos/en'
const INFO_CACHE_KEY = 'breadcrumb:bluebikes-stations:v1'
const STATUS_TTL_MS = 60_000

type DockInfo = { id: string; name: string; latitude: number; longitude: number; capacity: number }

export type NearbyDock = DockInfo & {
  miles: number
  bikes: number
  ebikes: number
  docks: number
  /** False when the dock is out of service. */
  renting: boolean
}

type InfoFeed = { data: { stations: { station_id: string; name: string; lat: number; lon: number; capacity: number }[] } }
type StatusFeed = {
  data: {
    stations: {
      station_id: string
      num_bikes_available: number
      num_ebikes_available?: number
      num_docks_available: number
      is_renting: number
      is_installed: number
    }[]
  }
}

let infoPromise: Promise<DockInfo[]> | null = null
type StatusCache = { at: number; byId: Map<string, StatusFeed['data']['stations'][number]> }
let statusCache: StatusCache | null = null
let statusPromise: Promise<StatusCache> | null = null

function loadDocks(): Promise<DockInfo[]> {
  if (infoPromise) return infoPromise
  infoPromise = (async () => {
    try {
      const cached = sessionStorage.getItem(INFO_CACHE_KEY)
      if (cached) return JSON.parse(cached) as DockInfo[]
    } catch {
      // storage unavailable: just fetch
    }
    const res = await fetch(`${FEED}/station_information.json`)
    if (!res.ok) throw new Error(`Bluebikes ${res.status}`)
    const docks = ((await res.json()) as InfoFeed).data.stations.map((s) => ({
      id: s.station_id,
      name: s.name,
      latitude: s.lat,
      longitude: s.lon,
      capacity: s.capacity,
    }))
    try {
      sessionStorage.setItem(INFO_CACHE_KEY, JSON.stringify(docks))
    } catch {
      // ignore (e.g. storage full)
    }
    return docks
  })().catch((error) => {
    infoPromise = null
    throw error
  })
  return infoPromise
}

function loadStatus(): Promise<StatusCache> {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) return Promise.resolve(statusCache)
  if (statusPromise) return statusPromise
  statusPromise = (async () => {
    const res = await fetch(`${FEED}/station_status.json`)
    if (!res.ok) throw new Error(`Bluebikes ${res.status}`)
    const stations = ((await res.json()) as StatusFeed).data.stations
    const fresh: StatusCache = { at: Date.now(), byId: new Map(stations.map((s) => [s.station_id, s])) }
    statusCache = fresh
    return fresh
  })().finally(() => {
    statusPromise = null
  })
  return statusPromise
}

/** The closest working Bluebikes docks to a point, within `maxMiles`, nearest first. */
export async function getNearbyDocks(
  point: { latitude: number; longitude: number },
  { limit = 1, maxMiles = 0.3 }: { limit?: number; maxMiles?: number } = {},
): Promise<NearbyDock[]> {
  const [docks, status] = await Promise.all([loadDocks(), loadStatus()])
  return docks
    .map((d) => ({ ...d, miles: milesBetween(point, d) }))
    .filter((d) => d.miles <= maxMiles)
    .sort((a, b) => a.miles - b.miles)
    .map((d) => {
      const s = status.byId.get(d.id)
      return {
        ...d,
        bikes: s?.num_bikes_available ?? 0,
        ebikes: s?.num_ebikes_available ?? 0,
        docks: s?.num_docks_available ?? 0,
        renting: Boolean(s?.is_installed && s?.is_renting),
      }
    })
    .filter((d) => d.renting)
    .slice(0, limit)
}
