/**
 * Crumb checklists for the Active trail page: big tappable crumbs for the current
 * stop (CrumbChecklist, per docs/mockups/Mobile-Run.dc.html) and the whole trail
 * as a stop list grouped by stop (TrailChecklist), where finished stops turn
 * green and the current one orange (style guide: "During a run, reuse the stop
 * list"). Each crumb is a toggle button with aria-pressed.
 */
import { Check, LoaderCircle } from 'lucide-react'
import type { TrailCrumb, TrailStop } from '@/lib/api/trails'
import { cn } from '@/lib/utils'

type CrumbProps = {
  crumbs: TrailCrumb[]
  ticked: Set<string>
  pending: Set<string>
  onToggle: (crumbId: string) => void
}

/** One crumb: a full-width button with a 26px ring that fills green when done. */
function CrumbToggle({
  crumb,
  done,
  saving,
  onToggle,
  compact = false,
}: {
  crumb: TrailCrumb
  done: boolean
  saving: boolean
  onToggle: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={onToggle}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 border-0 border-b border-line bg-transparent text-left last:border-b-0',
        'rounded-[var(--radius-sm)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
        compact ? 'min-h-11 py-1.5' : 'min-h-[52px] py-2',
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
      </span>
    </button>
  )
}

/** "Crumbs here" card for the current stop. */
export function CrumbChecklist({ title, crumbs, ticked, pending, onToggle }: CrumbProps & { title: string }) {
  const done = crumbs.filter((c) => ticked.has(c.id)).length
  return (
    <div className="mt-4 rounded-card border border-line bg-white px-4 pt-3.5 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-base font-bold">{title}</h2>
        {crumbs.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {done} of {crumbs.length} done
          </span>
        ) : null}
      </div>
      {crumbs.length === 0 ? (
        <p className="mt-2 mb-2 text-base text-ink-2">No crumbs here. Enjoy the stop.</p>
      ) : (
        <div className="mt-1">
          {crumbs.map((crumb) => (
            <CrumbToggle
              key={crumb.id}
              crumb={crumb}
              done={ticked.has(crumb.id)}
              saving={pending.has(crumb.id)}
              onToggle={() => onToggle(crumb.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** The whole trail: every stop with its crumbs, plus crumbs between stops. */
export function TrailChecklist({
  stops,
  betweenStopCrumbs,
  currentIndex,
  onSelectStop,
  ticked,
  pending,
  onToggle,
}: Omit<CrumbProps, 'crumbs'> & {
  stops: TrailStop[]
  betweenStopCrumbs: TrailCrumb[]
  currentIndex: number
  onSelectStop: (index: number) => void
}) {
  return (
    <div className="mt-4 rounded-card border border-line bg-white px-5 py-5">
      <ol className="stops m-0">
        {stops.map((stop, i) => {
          const allDone = stop.crumbs.length > 0 && stop.crumbs.every((c) => ticked.has(c.id))
          const current = i === currentIndex
          return (
            <li key={stop.id} className={cn('stop', allDone && 'is-done')}>
              <span
                className={cn('num-ring', allDone ? 'num-ring--done' : current && 'num-ring--current')}
                aria-hidden
              >
                {allDone ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="stop__name">
                  <button
                    type="button"
                    onClick={() => onSelectStop(i)}
                    aria-current={current ? 'step' : undefined}
                    className="cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent p-0 text-left font-[inherit] text-inherit hover:underline focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
                  >
                    <span className="sr-only">Stop {i + 1}: </span>
                    {stop.placeName}
                    {allDone ? <span className="sr-only"> (all crumbs done)</span> : null}
                  </button>
                </h3>
                {stop.address ? <p className="stop__place">{stop.address}</p> : null}
                {stop.crumbs.length > 0 ? (
                  <div className="mt-1">
                    {stop.crumbs.map((crumb) => (
                      <CrumbToggle
                        key={crumb.id}
                        compact
                        crumb={crumb}
                        done={ticked.has(crumb.id)}
                        saving={pending.has(crumb.id)}
                        onToggle={() => onToggle(crumb.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {betweenStopCrumbs.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="m-0 text-base font-bold">Along the way</h3>
          <div className="mt-1">
            {betweenStopCrumbs.map((crumb) => (
              <CrumbToggle
                key={crumb.id}
                compact
                crumb={crumb}
                done={ticked.has(crumb.id)}
                saving={pending.has(crumb.id)}
                onToggle={() => onToggle(crumb.id)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
