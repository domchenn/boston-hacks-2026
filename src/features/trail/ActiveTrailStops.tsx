/**
 * The trail on Active trail, as one accordion of stops (style guide: "During a
 * run, reuse the stop list"). The stop you're at is open, and the rest are
 * collapsed to one line each. Tap a stop's name to open or close it.
 * - The ring on the left ticks every crumb at that place at once ("done here");
 *   tapping it again unticks them. Finishing a stop is reported with
 *   onStopDone so the page can collapse it and open the next one.
 * - An open stop shows how to get there (LegDirections), live transit on tap
 *   (StopTransit), what to do, its crumbs and the photos you added there.
 * - The photo button on the right attaches photos from the phone's library.
 * Crumbs between stops ("Along the way") sit under the list.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { StopTransit } from '@/components/StopTransit'
import type { TrailPhoto } from '@/lib/api/photos'
import type { TrailCrumb, TrailStop } from '@/lib/api/trails'
import { legColor } from '@/lib/transitColors'
import { cn } from '@/lib/utils'
import type { TransitLine } from '@/types/db-values'
import { StopPhotoButton, StopPhotoStrip } from './ActiveTrailPhotos'
import { LegDirections } from './LegDirections'

/** One crumb: a full-width toggle with a 26px ring that fills green when done. */
function CrumbToggle({
  crumb,
  done,
  saving,
  by,
  onToggle,
}: {
  crumb: TrailCrumb
  done: boolean
  saving: boolean
  /** A friend's name when they ticked it. */
  by?: string | null
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={onToggle}
      className={cn(
        'flex min-h-[52px] w-full cursor-pointer items-center gap-3 border-0 border-b border-line bg-transparent py-2 text-left last:border-b-0',
        'rounded-[var(--radius-sm)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-[26px] flex-none place-items-center rounded-full transition-colors',
          done ? 'bg-done text-white' : 'border-[2.5px] border-crumb bg-white',
        )}
      >
        {saving ? (
          <LoaderCircle className={cn('size-3.5 animate-spin', done ? 'text-white' : 'text-crumb-strong')} />
        ) : done ? (
          <Check className="size-4" strokeWidth={3} />
        ) : null}
      </span>
      <span className={cn('flex-1 text-base leading-snug', done && 'text-muted-foreground line-through decoration-1')}>
        <span className="font-semibold">{crumb.type === 'see' ? 'See: ' : 'Do: '}</span>
        {crumb.label}
        {done && by ? <span className="ml-1.5 text-xs font-semibold text-done">· {by}</span> : null}
      </span>
    </button>
  )
}

export type StopPhotos = {
  forStop: (stopId: string) => TrailPhoto[]
  add: (stopId: string, placeName: string, files: File[]) => void
  busyStop: string | null
}

type ActiveTrailStopsProps = {
  stops: TrailStop[]
  betweenStopCrumbs: TrailCrumb[]
  primaryLine: TransitLine | null
  /** The first stop with crumbs left ("next up"). */
  nextIndex: number
  openIds: Set<string>
  onToggleOpen: (stopId: string) => void
  ticked: Set<string>
  /** Who ticked a crumb, when it was a friend on the outing. */
  tickedBy?: (crumbId: string) => string | null
  pending: Set<string>
  onToggleCrumb: (crumbId: string) => void
  /** Tick or untick every crumb at a stop. */
  onSetStop: (stop: TrailStop, done: boolean) => void
  /** Moving on from a stop with no crumbs. */
  onNext: (index: number) => void
  photos: StopPhotos
  finished: boolean
}

export function ActiveTrailStops({
  stops,
  betweenStopCrumbs,
  primaryLine,
  nextIndex,
  openIds,
  onToggleOpen,
  ticked,
  tickedBy,
  pending,
  onToggleCrumb,
  onSetStop,
  onNext,
  photos,
  finished,
}: ActiveTrailStopsProps) {
  return (
    <div className="mt-4 rounded-card border border-line bg-white px-4 py-4 md:px-5">
      <ol className="stops m-0">
        {stops.map((stop, i) => {
          const doneCount = stop.crumbs.filter((c) => ticked.has(c.id)).length
          const allDone = stop.crumbs.length > 0 && doneCount === stop.crumbs.length
          const open = openIds.has(stop.id)
          const isNext = i === nextIndex && !finished
          const stopPhotos = photos.forStop(stop.id)
          const bodyId = `stop-body-${stop.id}`
          return (
            <li
              key={stop.id}
              id={`stop-${stop.id}`}
              className={cn('stop scroll-mt-24', allDone && 'is-done')}
              style={{ '--leg-color': legColor((stops[i + 1] ?? stop).travelModeToStop, primaryLine) } as CSSProperties}
            >
              {/* Ring: tick everything at this place. */}
              <button
                type="button"
                onClick={() => (stop.crumbs.length > 0 ? onSetStop(stop, !allDone) : onNext(i))}
                aria-pressed={stop.crumbs.length > 0 ? allDone : undefined}
                aria-label={
                  stop.crumbs.length === 0
                    ? `Done at ${stop.placeName}, go to the next stop`
                    : allDone
                      ? `Untick everything at ${stop.placeName}`
                      : `Done at ${stop.placeName}: tick all ${stop.crumbs.length} ${stop.crumbs.length === 1 ? 'crumb' : 'crumbs'}`
                }
                className={cn(
                  'num-ring relative cursor-pointer p-0 before:absolute before:-inset-2 before:content-[""]',
                  'focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
                  allDone ? 'num-ring--done' : isNext && 'num-ring--current',
                )}
              >
                {allDone ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
              </button>

              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <h3 className="stop__name min-w-0 flex-1">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={bodyId}
                      onClick={() => onToggleOpen(stop.id)}
                      className="flex w-full cursor-pointer items-start justify-between gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent p-0 text-left font-[inherit] text-inherit focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="sr-only">Stop {i + 1}: </span>
                        {stop.placeName}
                      </span>
                      <ChevronDown
                        aria-hidden
                        className={cn('mt-1.5 size-5 flex-none text-muted-foreground transition-transform', open && 'rotate-180')}
                      />
                    </button>
                  </h3>
                  <StopPhotoButton
                    placeName={stop.placeName}
                    count={stopPhotos.length}
                    busy={photos.busyStop === stop.id}
                    onPick={(files) => photos.add(stop.id, stop.placeName, files)}
                  />
                </div>
                <p className="stop__place">
                  {isNext ? <span className="font-semibold text-crumb-strong">Next up · </span> : null}
                  {stop.crumbs.length > 0
                    ? allDone
                      ? 'All done here'
                      : `${doneCount} of ${stop.crumbs.length} ${stop.crumbs.length === 1 ? 'crumb' : 'crumbs'}`
                    : stop.address}
                </p>

                {open ? (
                  <div id={bodyId} className="mt-3">
                    {stop.address && stop.crumbs.length > 0 ? <p className="m-0 mb-3 text-sm text-ink-2">{stop.address}</p> : null}
                    {!allDone ? <LegDirections from={stops[i - 1] ?? null} to={stop} /> : null}
                    {isNext && stop.latitude !== null && stop.longitude !== null ? (
                      <StopTransit latitude={stop.latitude} longitude={stop.longitude} refreshMs={30_000} className="mt-3" />
                    ) : null}
                    {stop.plannedActivity ? <p className="mt-3 mb-0 text-base leading-normal text-ink">{stop.plannedActivity}</p> : null}

                    {stop.crumbs.length > 0 ? (
                      <div className="mt-2">
                        {stop.crumbs.map((crumb) => (
                          <CrumbToggle
                            key={crumb.id}
                            crumb={crumb}
                            done={ticked.has(crumb.id)}
                            by={tickedBy?.(crumb.id)}
                            saving={pending.has(crumb.id)}
                            onToggle={() => onToggleCrumb(crumb.id)}
                          />
                        ))}
                      </div>
                    ) : null}

                    <StopPhotoStrip photos={stopPhotos} placeName={stop.placeName} />

                    {!finished && !allDone ? (
                      <button
                        type="button"
                        className="btn btn--sm mt-3"
                        onClick={() => (stop.crumbs.length > 0 ? onSetStop(stop, true) : onNext(i))}
                      >
                        <Check aria-hidden />
                        {i === stops.length - 1 ? 'Done here' : 'Done here, next stop'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {betweenStopCrumbs.length > 0 ? (
        <AlongTheWay>
          {betweenStopCrumbs.map((crumb) => (
            <CrumbToggle
              key={crumb.id}
              crumb={crumb}
              done={ticked.has(crumb.id)}
              by={tickedBy?.(crumb.id)}
              saving={pending.has(crumb.id)}
              onToggle={() => onToggleCrumb(crumb.id)}
            />
          ))}
        </AlongTheWay>
      ) : null}
    </div>
  )
}

function AlongTheWay({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="m-0 text-base font-bold">Along the way</h3>
      <div className="mt-1">{children}</div>
    </div>
  )
}
