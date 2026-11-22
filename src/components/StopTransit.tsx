/**
 * Live transit under a place (task D7), e.g.
 *   T  [R] Charles/MGH · 0.2 mi     Red Line → Alewife 3, 9 min · → Ashmont 5 min
 *   Bus  Charles St @ Beacon St     43 → Ruggles 6 min
 *   Bluebikes  Charles St at Beacon · 0.1 mi · 7 bikes · 9 open docks
 * Stations and the bus stop are found once; arrivals and bike counts refresh
 * every `refreshMs` while the tab is visible. Every number comes from the MBTA
 * or Bluebikes APIs: nothing is estimated. Hidden entirely if nothing is nearby.
 * Used under each stop on Trail detail and for the current stop on Active trail.
 *
 * `collapsible` (Trail detail): starts as one quiet line, "Near [R] Charles/MGH ·
 * 0.2 mi · Live times", and only loads arrivals, buses and bikes once opened, so
 * planning a trail isn't buried in minute-by-minute numbers.
 */

import { useEffect, useState } from 'react'
import { Bike, Bus, ChevronDown, TrainFront } from 'lucide-react'
import { getNearbyDocks, type NearbyDock } from '@/lib/bluebikes'
import {
  LINE_COLORS,
  getArrivals,
  getNearbyBusStops,
  loadStations,
  nearestStations,
  type Arrival,
  type BusStop,
  type NearbyStation,
} from '@/lib/mbta'
import { cn } from '@/lib/utils'

type StopTransitProps = {
  latitude: number
  longitude: number
  /** How often to refresh arrivals and bikes (default 60 s; Active trail uses 30 s). */
  refreshMs?: number
  /** Start as a one-line summary with a "Live times" toggle (Trail detail). */
  collapsible?: boolean
  className?: string
}

type Nearby = { stations: NearbyStation[]; busStops: BusStop[] }

const miles = (m: number) => (m < 0.1 ? '<0.1 mi' : `${m.toFixed(1)} mi`)
const minutesText = (list: number[]) => list.map((m) => (m === 0 ? 'now' : String(m))).join(', ') + (list.at(-1) === 0 ? '' : ' min')

function LinePill({ line }: { line: NearbyStation['lines'][number] }) {
  return (
    <span
      className="rounded-pill px-1.5 py-0.5 text-[11px] leading-none font-bold text-white"
      style={{ backgroundColor: LINE_COLORS[line] }}
    >
      {line === 'Mattapan' ? 'M' : line[0]}
      <span className="sr-only"> {line} Line</span>
    </span>
  )
}

function ArrivalItem({ arrival }: { arrival: Arrival }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-2 flex-none rounded-full" style={{ backgroundColor: arrival.color }} />
      <span className="text-ink-2">
        {arrival.routeName}
        {arrival.headsign ? ` → ${arrival.headsign}` : ''}
      </span>
      <span className="font-semibold text-ink">{minutesText(arrival.minutes)}</span>
    </span>
  )
}

export function StopTransit({ latitude, longitude, refreshMs = 60_000, collapsible = false, className }: StopTransitProps) {
  const [open, setOpen] = useState(!collapsible)
  const [nearby, setNearby] = useState<Nearby | null>(null)
  const [arrivals, setArrivals] = useState<Arrival[]>([])
  const [docks, setDocks] = useState<NearbyDock[]>([])

  // 1. What's nearby (once per place).
  useEffect(() => {
    let cancelled = false
    const point = { latitude, longitude }
    Promise.all([
      loadStations().then((all) => nearestStations(all, point, { limit: 2 })).catch(() => [] as NearbyStation[]),
      getNearbyBusStops(point, 1).catch(() => [] as BusStop[]),
    ]).then(([stations, busStops]) => {
      if (!cancelled) setNearby({ stations, busStops })
    })
    return () => {
      cancelled = true
    }
  }, [latitude, longitude])

  // 2. Live arrivals + bikes: now, then every refreshMs while the tab is visible.
  const stopIds = nearby ? [...nearby.stations.map((s) => s.id), ...nearby.busStops.map((s) => s.id)].join(',') : ''
  useEffect(() => {
    if (!nearby || !open) return
    let cancelled = false
    const run = () => {
      if (document.visibilityState !== 'visible') return
      if (stopIds) getArrivals(stopIds.split(',')).then((a) => !cancelled && setArrivals(a), () => undefined)
      getNearbyDocks({ latitude, longitude }).then((d) => !cancelled && setDocks(d), () => undefined)
    }
    run()
    const id = setInterval(run, refreshMs)
    document.addEventListener('visibilitychange', run)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
    }
  }, [nearby, open, stopIds, latitude, longitude, refreshMs])

  if (!nearby) return null

  if (!open) {
    const station = nearby.stations[0]
    if (!station && nearby.busStops.length === 0) return null
    return (
      <p className={cn('mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground', className)}>
        {station ? (
          <span className="inline-flex items-center gap-1.5">
            <TrainFront aria-hidden className="size-4 text-ink-2" />
            Near
            {station.lines.map((line) => (
              <LinePill key={line} line={line} />
            ))}
            <span className="text-ink-2">{station.name}</span>· {miles(station.miles)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Bus aria-hidden className="size-4 text-ink-2" />
            Bus stop nearby
          </span>
        )}
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-0.5 rounded-[var(--radius-sm)] border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:text-crumb-deep focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
        >
          Live times
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </p>
    )
  }

  const rail = arrivals.filter((a) => a.kind === 'subway' || a.kind === 'light_rail').slice(0, 4)
  const buses = arrivals.filter((a) => a.kind === 'bus').slice(0, 2)
  const busStop = nearby.busStops[0]
  const dock = docks[0]
  if (nearby.stations.length === 0 && !busStop && !dock) return null

  return (
    <div className={cn('mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground', className)} aria-live="polite">
      {collapsible ? (
        <button
          type="button"
          aria-expanded
          onClick={() => setOpen(false)}
          className="inline-flex w-fit cursor-pointer items-center gap-0.5 rounded-[var(--radius-sm)] border-0 bg-transparent p-0 text-sm font-semibold text-crumb-strong hover:text-crumb-deep focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
        >
          Hide live times
          <ChevronDown aria-hidden className="size-3.5 rotate-180" />
        </button>
      ) : null}
      {nearby.stations.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
            <TrainFront aria-hidden className="size-4" />T
          </span>
          {nearby.stations.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              {s.lines.map((line) => (
                <LinePill key={line} line={line} />
              ))}
              <span className="text-ink-2">{s.name}</span>
              <span>· {miles(s.miles)}</span>
            </span>
          ))}
          {rail.map((a) => (
            <ArrivalItem key={`${a.routeId}|${a.headsign}`} arrival={a} />
          ))}
        </div>
      ) : null}

      {busStop ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
            <Bus aria-hidden className="size-4" />
            Bus
          </span>
          <span className="text-ink-2">{busStop.name}</span>
          {buses.map((a) => (
            <ArrivalItem key={`${a.routeId}|${a.headsign}`} arrival={a} />
          ))}
        </div>
      ) : null}

      {dock ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
            <Bike aria-hidden className="size-4" />
            Bluebikes
          </span>
          <span className="text-ink-2">{dock.name}</span>
          <span>· {miles(dock.miles)}</span>
          <span className="font-semibold text-ink">
            {dock.bikes} {dock.bikes === 1 ? 'bike' : 'bikes'}
            {dock.ebikes > 0 ? ` (${dock.ebikes} e-bike${dock.ebikes === 1 ? '' : 's'})` : ''}
          </span>
          <span>· {dock.docks} open {dock.docks === 1 ? 'dock' : 'docks'}</span>
        </div>
      ) : null}
    </div>
  )
}
