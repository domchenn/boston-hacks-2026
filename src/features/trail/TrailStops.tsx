/**
 * "The trail" on the Trail detail page: numbered stops joined by dotted lines, each
 * with its address, what to do there, its crumbs (See / Do) and how to get to the
 * next stop in that leg's color (@/lib/transitColors): one line ("Walk about 8 min
 * to …", or the T line to ride) that opens step-by-step directions (LegSummary), plus
 * the nearest T station (StopTransit, collapsed: live arrivals, buses and
 * Bluebikes open on tap, so the plan stays readable).
 * Directions come from Google; without them it shows the stored travel mode. No
 * invented times or routes. Styled by .stops / .stop / .crumb-item in components.css.
 */

import type { CSSProperties } from 'react'
import { StopTransit } from '@/components/StopTransit'
import type { TrailCrumb, TrailStop } from '@/lib/api/trails'
import { legColor } from '@/lib/transitColors'
import type { TransitLine } from '@/types/db-values'
import { LegSummary } from './LegDirections'

function CrumbItem({ crumb }: { crumb: TrailCrumb }) {
  return (
    <li className="crumb-item">
      <span>
        <b>{crumb.type === 'see' ? 'See:' : 'Do:'}</b> {crumb.label}
      </span>
    </li>
  )
}

export function TrailStops({
  stops,
  betweenStopCrumbs,
  primaryLine = null,
}: {
  stops: TrailStop[]
  betweenStopCrumbs: TrailCrumb[]
  /** The trail's main T line, used to color T legs. */
  primaryLine?: TransitLine | null
}) {
  if (stops.length === 0) {
    return <p className="mt-4 text-base text-ink-2">This trail doesn't have any stops yet.</p>
  }

  return (
    <div className="mt-4 rounded-card border border-line bg-white px-5 py-5 md:px-6">
      <ol className="stops m-0">
        {stops.map((stop, i) => {
          const next = stops[i + 1]
          const showActivity = stop.plannedActivity && stop.plannedActivity !== stop.description
          return (
            <li
              key={stop.id}
              className="stop"
              // Ring + dots down to the next stop in the color of that leg (last stop: the leg that arrives).
              style={{ '--leg-color': legColor((next ?? stop).travelModeToStop, primaryLine) } as CSSProperties}
            >
              <span className="num-ring">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="stop__name">{stop.placeName}</h3>
                {stop.address ? <p className="stop__place">{stop.address}</p> : null}
                {stop.latitude !== null && stop.longitude !== null ? (
                  <StopTransit latitude={stop.latitude} longitude={stop.longitude} collapsible />
                ) : null}
                {stop.description ? <p className="mt-2 text-base leading-normal text-ink-2">{stop.description}</p> : null}
                {showActivity ? <p className="mt-2 text-base leading-normal text-ink-2">{stop.plannedActivity}</p> : null}
                {stop.crumbs.length > 0 ? (
                  <ul className="m-0 list-none p-0">
                    {stop.crumbs.map((crumb) => (
                      <CrumbItem key={crumb.id} crumb={crumb} />
                    ))}
                  </ul>
                ) : null}
                {stop.notes ? <p className="mt-2 text-sm text-muted-foreground">{stop.notes}</p> : null}
                {next ? <LegSummary from={stop} to={next} /> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {betweenStopCrumbs.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-base font-bold">On the way</h3>
          <ul className="m-0 list-none p-0">
            {betweenStopCrumbs.map((crumb) => (
              <CrumbItem key={crumb.id} crumb={crumb} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
