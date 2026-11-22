/**
 * Service alerts for the T stations near a trail's stops (task D7), e.g.
 *   ⚠ Red Line: shuttle buses replace service between JFK/UMass and Braintree…
 * Finds the stations within ~3/4 mile of each stop, asks the MBTA for active
 * alerts at those stations (severity 3+, no elevator/escalator notices), and
 * shows the most severe two with a "Show more" toggle. Hidden when there are
 * none or the API fails. Used on Trail detail and Active trail.
 */

import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { getAlerts, loadStations, nearestStations, type TransitAlert } from '@/lib/mbta'
import { cn } from '@/lib/utils'

type TransitAlertsProps = {
  /** The trail's stops (only ones with coordinates are used). */
  stops: { latitude: number | null; longitude: number | null }[]
  className?: string
}

export function TransitAlerts({ stops, className }: TransitAlertsProps) {
  const [alerts, setAlerts] = useState<TransitAlert[]>([])
  const [expanded, setExpanded] = useState(false)
  const pointsKey = stops
    .filter((s) => s.latitude !== null && s.longitude !== null)
    .map((s) => `${s.latitude},${s.longitude}`)
    .join('|')

  useEffect(() => {
    if (!pointsKey) return
    let cancelled = false
    const points = pointsKey.split('|').map((p) => {
      const [latitude, longitude] = p.split(',').map(Number)
      return { latitude, longitude }
    })
    loadStations()
      .then((all) => {
        const ids = [...new Set(points.flatMap((p) => nearestStations(all, p, { limit: 2 }).map((s) => s.id)))]
        return getAlerts(ids)
      })
      .then(
        (list) => !cancelled && setAlerts(list),
        () => undefined,
      )
    return () => {
      cancelled = true
    }
  }, [pointsKey])

  if (alerts.length === 0) return null
  const shown = expanded ? alerts : alerts.slice(0, 2)

  return (
    <section
      aria-label="T service alerts near this trail"
      className={cn('rounded-card border border-[#E5A800]/50 bg-[#FFF8E1] px-4 py-3 text-sm text-ink', className)}
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((alert) => (
          <li key={alert.id} className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none text-[#B07D00]" />
            <span>{alert.header}</span>
          </li>
        ))}
      </ul>
      {alerts.length > 2 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-crumb-strong hover:text-crumb-deep"
        >
          {expanded ? 'Show fewer' : `Show ${alerts.length - 2} more`}
        </button>
      ) : null}
      <p className="mt-2 mb-0 text-xs text-muted-foreground">Live from the MBTA.</p>
    </section>
  )
}
