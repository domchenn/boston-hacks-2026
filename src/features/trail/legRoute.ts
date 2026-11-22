/**
 * Routes between two stops of a trail, from Google (the Routes API, or the legacy
 * Directions service if that isn't enabled for the key), turned
 * into a short list of steps (walk / ride a line / bike) with rough minutes. Shared
 * by LegDirections (Active trail) and LegSummary (Trail detail). Results are cached
 * while the page is open. null = no route (no coordinates, no API key, or Google
 * failed); callers then fall back to the stored travel mode and never invent steps.
 */

import { Bike, Bus, Footprints, TrainFront } from 'lucide-react'
import type { TrailStop } from '@/lib/api/trails'
import { googleTravelMode, loadGoogleMaps } from '@/lib/maps'
import type { TravelMode } from '@/types/db-values'

export type Step =
  | { kind: 'walk' | 'bike'; minutes: number; to: string | null }
  | {
      kind: 'ride'
      vehicle: 'subway' | 'bus' | 'train'
      line: string
      color: string | null
      headsign: string | null
      stops: number | null
      offAt: string | null
    }

export type Route = { minutes: number; steps: Step[] }

/** Routes reused while the page is open (keyed by from|to|mode). null = Google had no route. */
const routeCache = new Map<string, Route | null>()

/** "about 4 min", rounded so it reads like a rough guide, not a timetable. */
export function roughMinutes(minutes: number) {
  if (minutes <= 1) return '1 min'
  if (minutes < 10) return `${Math.round(minutes)} min`
  if (minutes < 60) return `${Math.round(minutes / 5) * 5} min`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round((minutes % 60) / 15) * 15
  return rest === 0 || rest === 60 ? `${rest === 60 ? hours + 1 : hours} hr` : `${hours} hr ${rest} min`
}

export const FALLBACK: Record<TravelMode, { verb: string; icon: typeof Footprints }> = {
  walk: { verb: 'Walk to', icon: Footprints },
  train: { verb: 'Take the T to', icon: TrainFront },
  bus: { verb: 'Take the bus to', icon: Bus },
  bike: { verb: 'Bike to', icon: Bike },
}

function vehicleOf(type: string | undefined): 'subway' | 'bus' | 'train' {
  if (type === 'BUS' || type === 'TROLLEYBUS' || type === 'SHARE_TAXI') return 'bus'
  if (type === 'HEAVY_RAIL' || type === 'COMMUTER_TRAIN' || type === 'RAIL' || type === 'HIGH_SPEED_TRAIN')
    return 'train'
  return 'subway'
}

/** Turns Google's steps into our short list, merging back-to-back walks. */
function toRoute(leg: google.maps.DirectionsLeg): Route {
  const steps: Step[] = []
  for (const step of leg.steps) {
    const minutes = (step.duration?.value ?? 0) / 60
    if (step.travel_mode === 'TRANSIT' && step.transit) {
      const t = step.transit
      steps.push({
        kind: 'ride',
        vehicle: vehicleOf(t.line?.vehicle?.type),
        line: t.line?.short_name || t.line?.name || 'Transit',
        color: t.line?.color || null,
        headsign: t.headsign || null,
        stops: t.num_stops ?? null,
        offAt: t.arrival_stop?.name ?? null,
      })
      // The walk before this ride heads to where it leaves from.
      const prev = steps[steps.length - 2]
      if (prev && prev.kind === 'walk') prev.to = t.departure_stop?.name ?? null
    } else {
      const kind = step.travel_mode === 'BICYCLING' ? 'bike' : 'walk'
      const last = steps[steps.length - 1]
      if (last && last.kind === kind) last.minutes += minutes
      else steps.push({ kind, minutes, to: null })
    }
  }
  return { minutes: (leg.duration?.value ?? 0) / 60, steps }
}

/** The same short list from the Routes API (google.maps.routes), merging back-to-back walks. */
function fromRoutesApi(route: google.maps.routes.Route): Route | null {
  const leg = route.legs?.[0]
  if (!leg || leg.steps.length === 0) return null
  const steps: Step[] = []
  for (const step of leg.steps) {
    const minutes = (step.staticDurationMillis ?? 0) / 60000
    const t = step.transitDetails
    if (step.travelMode === 'TRANSIT' && t) {
      steps.push({
        kind: 'ride',
        vehicle: vehicleOf(t.transitLine?.vehicle?.vehicleType ?? undefined),
        line: t.transitLine?.shortName || t.transitLine?.name || 'Transit',
        color: t.transitLine?.color || null,
        headsign: t.headsign || null,
        stops: t.stopCount || null,
        offAt: t.arrivalStop?.name ?? null,
      })
      const prev = steps[steps.length - 2]
      if (prev && prev.kind === 'walk') prev.to = t.departureStop?.name ?? null
    } else {
      const kind = step.travelMode === 'BICYCLING' ? 'bike' : 'walk'
      const last = steps[steps.length - 1]
      if (last && last.kind === kind) last.minutes += minutes
      else steps.push({ kind, minutes, to: null })
    }
  }
  const total = route.durationMillis ?? leg.durationMillis ?? leg.staticDurationMillis ?? 0
  return { minutes: total / 60000, steps }
}

type LatLng = { lat: number; lng: number }

/** Routes API first (the current Google service); the legacy Directions service if that fails. */
async function requestRoute(origin: LatLng, destination: LatLng, mode: 'walking' | 'transit' | 'bicycling') {
  const maps = await loadGoogleMaps()
  try {
    const { Route: RoutesRoute } = (await maps.importLibrary('routes')) as google.maps.RoutesLibrary
    const travelMode = ({ walking: 'WALKING', transit: 'TRANSIT', bicycling: 'BICYCLING' } as const)[mode]
    const { routes } = await RoutesRoute.computeRoutes({
      origin,
      destination,
      travelMode,
      fields: ['durationMillis', 'legs'],
    })
    const first = routes?.[0]
    if (first) return fromRoutesApi(first)
  } catch {
    // Routes API not enabled for this key (or no route): try the legacy service below.
  }
  const travelMode = {
    walking: maps.TravelMode.WALKING,
    transit: maps.TravelMode.TRANSIT,
    bicycling: maps.TravelMode.BICYCLING,
  }[mode]
  const result = await new maps.DirectionsService().route({ origin, destination, travelMode })
  const leg = result.routes[0]?.legs[0]
  return leg && leg.steps.length ? toRoute(leg) : null
}

export async function findRoute(from: TrailStop, to: TrailStop): Promise<Route | null> {
  if (from.latitude === null || from.longitude === null || to.latitude === null || to.longitude === null) return null
  const mode = googleTravelMode(to.travelModeToStop)
  const key = `${from.latitude},${from.longitude}|${to.latitude},${to.longitude}|${mode}`
  if (routeCache.has(key)) return routeCache.get(key) ?? null
  try {
    const route = await requestRoute(
      { lat: from.latitude, lng: from.longitude },
      { lat: to.latitude, lng: to.longitude },
      mode,
    )
    routeCache.set(key, route)
    return route
  } catch {
    routeCache.set(key, null)
    return null
  }
}
