/**
 * "T nearby" line under a place: the closest MBTA subway / light-rail stations
 * with their line colors and straight-line distance, e.g.
 *   T nearby: [Red] Charles/MGH · 0.1 mi   [Green] Arlington · 0.3 mi
 * Data from @/lib/mbta (public MBTA V3 API, cached per session). Shows nothing
 * while loading, on error, or when no station is within ~3/4 mile, so it never
 * gets in the way. Used under each stop on Trail detail.
 */

import { useEffect, useState } from 'react'
import { TrainFront } from 'lucide-react'
import { LINE_COLORS, loadStations, nearestStations, type NearbyStation } from '@/lib/mbta'
import { cn } from '@/lib/utils'

type NearbyStationsProps = {
  latitude: number
  longitude: number
  /** How many stations to show (default 2). */
  limit?: number
  className?: string
}

function formatMiles(miles: number) {
  return miles < 0.1 ? '<0.1 mi' : `${miles.toFixed(1)} mi`
}

export function NearbyStations({ latitude, longitude, limit = 2, className }: NearbyStationsProps) {
  const [stations, setStations] = useState<NearbyStation[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadStations()
      .then((all) => {
        if (!cancelled) setStations(nearestStations(all, { latitude, longitude }, { limit }))
      })
      .catch(() => {
        if (!cancelled) setStations([])
      })
    return () => {
      cancelled = true
    }
  }, [latitude, longitude, limit])

  if (!stations || stations.length === 0) return null

  return (
    <p className={cn('mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
        <TrainFront aria-hidden className="size-4" />T nearby:
      </span>
      {stations.map((station) => (
        <span key={station.id} className="inline-flex items-center gap-1.5">
          {station.lines.map((line) => (
            <span
              key={line}
              className="rounded-pill px-1.5 py-0.5 text-[11px] leading-none font-bold text-white"
              style={{ backgroundColor: LINE_COLORS[line] }}
              title={line === 'Green' && station.greenBranches.length ? `Green Line ${station.greenBranches.join(', ')}` : `${line} Line`}
            >
              {line === 'Mattapan' ? 'M' : line[0]}
              <span className="sr-only"> {line} Line</span>
            </span>
          ))}
          <span className="text-ink-2">{station.name}</span>
          <span>· {formatMiles(station.miles)}</span>
        </span>
      ))}
    </p>
  )
}
