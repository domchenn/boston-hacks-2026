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
 *
 * LegSummary is the minimal version for the Trail detail page: one line between
 * two stops ("Walk about 8 min to …", or the line to ride and the total time) that
 * opens the same step list on tap. Route data: ./legRoute.
 */

import { useEffect, useState } from 'react'
import { Bike, Bus, ChevronDown, Footprints, Navigation, TrainFront } from 'lucide-react'
import type { TrailStop } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import { directionsLink } from './directions-link'
import { FALLBACK, findRoute, roughMinutes, type Route, type Step } from './legRoute'

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

/** One line for a route: the line(s) to ride, or the walk / bike, with rough total time. */
function summaryOf(route: Route, to: TrailStop) {
  const rides = route.steps.filter((s): s is Extract<Step, { kind: 'ride' }> => s.kind === 'ride')
  const total = `about ${roughMinutes(route.minutes)}`
  if (rides.length === 0) {
    const mode = route.steps.some((s) => s.kind === 'bike') ? 'Bike' : 'Walk'
    return { icon: mode === 'Bike' ? Bike : Footprints, rides, text: `${mode} ${total} to ${to.placeName}` }
  }
  return { icon: rides[0].vehicle === 'bus' ? Bus : TrainFront, rides, text: `to ${to.placeName} · ${total}` }
}

/**
 * Trail detail: how to get from `from` to `to`, kept to one line until tapped.
 * Shows the stored travel mode ("Walk to …") until the route loads, or if there isn't one.
 */
export function LegSummary({ from, to }: { from: TrailStop; to: TrailStop }) {
  const [route, setRoute] = useState<Route | null | undefined>(undefined)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    findRoute(from, to).then((r) => !cancelled && setRoute(r))
    return () => {
      cancelled = true
    }
  }, [from, to])

  if (!route) {
    // No route yet (or none at all): the stored travel mode, if the trail has one. Never a guess.
    if (!to.travelModeToStop) return null
    const fallback = FALLBACK[to.travelModeToStop]
    return (
      <p className="stop__leg">
        <fallback.icon aria-hidden />
        {fallback.verb} {to.placeName}
      </p>
    )
  }

  const summary = summaryOf(route, to)
  const steps = route.steps.filter((step) => step.kind === 'ride' || step.minutes >= 0.5)
  const mapsLink = (
    <a
      href={directionsLink(to, from)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-crumb-strong hover:text-crumb-deep"
    >
      <Navigation aria-hidden className="size-3.5" />
      {summary.rides.length === 0 ? 'Map' : 'Open in Google Maps'}
      <span className="sr-only"> (directions from {from.placeName} to {to.placeName}, opens in a new tab)</span>
    </a>
  )

  // A plain walk or bike: one line is the whole story, so nothing to open.
  if (summary.rides.length === 0) {
    return (
      <p className="stop__leg">
        <summary.icon aria-hidden />
        <span className="min-w-0">
          {summary.text} · {mapsLink}
        </span>
      </p>
    )
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="stop__leg m-0 cursor-pointer border-0 bg-transparent p-0 text-left hover:text-ink"
      >
        <summary.icon aria-hidden />
        <span className="min-w-0">
          {summary.rides.map((ride, i) => (
            <span
              key={i}
              className="mr-1 inline-block rounded-pill px-1.5 py-px text-[11px] leading-tight font-bold text-white"
              style={{ backgroundColor: ride.color ?? 'var(--color-ink-2)' }}
            >
              {ride.line}
            </span>
          ))}
          {summary.text}
        </span>
        <ChevronDown aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
        <span className="sr-only">{open ? ', hide directions' : ', show directions'}</span>
      </button>
      {open ? (
        <div className="mt-2 rounded-[var(--radius-md)] bg-paper px-3 py-2.5">
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 text-sm leading-snug text-ink">
                <StepIcon step={step} />
                <span className="min-w-0">
                  <StepText step={step} />
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2">{mapsLink}</div>
        </div>
      ) : null}
    </div>
  )
}
