/**
 * "Getting here" for one stop on Active trail: how to get from the previous stop
 * to this one, as a short step list from the Google Directions service, e.g.
 *   About 15 min
 *   🚶 Walk about 4 min to Park Street
 *   🚇 Green Line toward Heath Street · 3 stops · off at Copley
 *   🚶 Walk about 2 min
 * Times are rounded on purpose (no departure times): live arrivals sit behind
 * "Live times" (StopTransit). If there's no route (no coordinates, no API key,
 * Google fails) it falls back to the stored travel mode ("Take the T to …") and
 * never invents steps. The first stop has no previous stop, so it just points to
 * Google Maps, which routes from the phone's own location. Used by ActiveTrailStops.
 */

import { useEffect, useState } from 'react'
import { Bike, Bus, Footprints, Navigation, TrainFront } from 'lucide-react'
import type { TrailStop } from '@/lib/api/trails'
import { googleTravelMode, loadGoogleMaps } from '@/lib/maps'
import { cn } from '@/lib/utils'
import type { TravelMode } from '@/types/db-values'
import { directionsLink } from './directions-link'

type Step =
  | { kind: 'walk' | 'bike'; minutes: number; to: string | null }
  | { kind: 'ride'; vehicle: 'subway' | 'bus' | 'train'; line: string; color: string | null; headsign: string | null; stops: number | null; offAt: string | null }

type Route = { minutes: number; steps: Step[] }

/** Routes reused while the page is open (keyed by from|to|mode). null = Google had no route. */
const routeCache = new Map<string, Route | null>()

/** "about 4 min", rounded so it reads like a rough guide, not a timetable. */
function roughMinutes(minutes: number) {
  if (minutes <= 1) return '1 min'
  if (minutes < 10) return `${Math.round(minutes)} min`
  if (minutes < 60) return `${Math.round(minutes / 5) * 5} min`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round((minutes % 60) / 15) * 15
  return rest === 0 || rest === 60 ? `${rest === 60 ? hours + 1 : hours} hr` : `${hours} hr ${rest} min`
}

const FALLBACK: Record<TravelMode, { verb: string; icon: typeof Footprints }> = {
  walk: { verb: 'Walk to', icon: Footprints },
  train: { verb: 'Take the T to', icon: TrainFront },
  bus: { verb: 'Take the bus to', icon: Bus },
  bike: { verb: 'Bike to', icon: Bike },
}

function vehicleOf(type: string | undefined): 'subway' | 'bus' | 'train' {
  if (type === 'BUS' || type === 'TROLLEYBUS' || type === 'SHARE_TAXI') return 'bus'
  if (type === 'HEAVY_RAIL' || type === 'COMMUTER_TRAIN' || type === 'RAIL' || type === 'HIGH_SPEED_TRAIN') return 'train'
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

async function findRoute(from: TrailStop, to: TrailStop): Promise<Route | null> {
  if (from.latitude === null || from.longitude === null || to.latitude === null || to.longitude === null) return null
  const mode = googleTravelMode(to.travelModeToStop)
  const key = `${from.latitude},${from.longitude}|${to.latitude},${to.longitude}|${mode}`
  if (routeCache.has(key)) return routeCache.get(key) ?? null
  try {
    const maps = await loadGoogleMaps()
    const travelMode = { walking: maps.TravelMode.WALKING, transit: maps.TravelMode.TRANSIT, bicycling: maps.TravelMode.BICYCLING }[mode]
    const result = await new maps.DirectionsService().route({
      origin: { lat: from.latitude, lng: from.longitude },
      destination: { lat: to.latitude, lng: to.longitude },
      travelMode,
    })
    const leg = result.routes[0]?.legs[0]
    const route = leg && leg.steps.length ? toRoute(leg) : null
    routeCache.set(key, route)
    return route
  } catch {
    routeCache.set(key, null)
    return null
  }
}

function StepIcon({ step }: { step: Step }) {
  const Icon =
    step.kind === 'ride' ? (step.vehicle === 'bus' ? Bus : TrainFront) : step.kind === 'bike' ? Bike : Footprints
  return (
    <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-paper text-ink-2">
      <Icon className="size-4" />
    </span>
  )
}

function StepText({ step }: { step: Step }) {
  if (step.kind !== 'ride') {
    return (
      <>
        {step.kind === 'walk' ? 'Walk' : 'Bike'} about {roughMinutes(step.minutes)}
        {step.to ? ` to ${step.to}` : ''}
      </>
    )
  }
  return (
    <>
      <span
        className="mr-1.5 inline-block rounded-pill px-2 py-0.5 text-xs leading-tight font-bold text-white"
        style={{ backgroundColor: step.color ?? 'var(--color-ink-2)' }}
      >
        {step.line}
      </span>
      {step.headsign ? `toward ${step.headsign}` : step.vehicle === 'bus' ? 'bus' : 'train'}
      {step.stops ? ` · ${step.stops} ${step.stops === 1 ? 'stop' : 'stops'}` : ''}
      {step.offAt ? ` · off at ${step.offAt}` : ''}
    </>
  )
}

export function LegDirections({ from, to, className }: { from: TrailStop | null; to: TrailStop; className?: string }) {
  const [route, setRoute] = useState<Route | null | undefined>(undefined)

  useEffect(() => {
    if (!from) return
    let cancelled = false
    findRoute(from, to).then((r) => !cancelled && setRoute(r))
    return () => {
      cancelled = true
    }
  }, [from, to])

  const link = (
    <a href={directionsLink(to)} target="_blank" rel="noreferrer" className="btn btn--secondary btn--sm mt-3">
      <Navigation aria-hidden />
      Open in Google Maps
      <span className="sr-only"> (directions to {to.placeName}, opens in a new tab)</span>
    </a>
  )

  let body
  if (!from) {
    body = <p className="m-0 text-base text-ink-2">Head to the first stop. Google Maps routes you from where you are.</p>
  } else if (route === undefined) {
    body = <div aria-hidden className="h-12 animate-pulse rounded-[var(--radius-sm)] bg-sand" />
  } else if (route === null) {
    const fallback = FALLBACK[to.travelModeToStop ?? 'walk']
    body = (
      <p className="m-0 flex items-center gap-2.5 text-base text-ink">
        <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-paper text-ink-2">
          <fallback.icon className="size-4" />
        </span>
        {fallback.verb} {to.placeName} from {from.placeName}
      </p>
    )
  } else {
    body = (
      <>
        <p className="m-0 text-sm text-muted-foreground">
          From {from.placeName} · about {roughMinutes(route.minutes)}
        </p>
        <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {route.steps
            .filter((step) => step.kind === 'ride' || step.minutes >= 0.5)
            .map((step, i) => (
              <li key={i} className="flex items-center gap-2.5 text-base leading-snug text-ink">
                <StepIcon step={step} />
                <span className="min-w-0">
                  <StepText step={step} />
                </span>
              </li>
            ))}
        </ol>
      </>
    )
  }

  return (
    <section aria-label={`Getting to ${to.placeName}`} className={cn('rounded-card border border-line bg-white px-4 py-3.5', className)}>
      <h4 className="m-0 mb-2 text-sm font-bold text-ink-2">Getting here</h4>
      {body}
      {link}
    </section>
  )
}
