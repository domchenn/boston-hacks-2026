/**
 * Explore's Cost filter: a pill ("Any cost", "Under $25", "$10–$25", "$25+") that
 * opens a small panel with quick picks and Min / Max dollar boxes. Values are
 * whole dollars per person as strings ('' = no limit), kept in the URL by
 * ExplorePage (?cost_min=&cost_max=). On phones the filter row scrolls sideways,
 * so the panel opens as a bottom sheet there instead of a dropdown.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COST_PRESETS, costLabel } from './filters'

type CostRangeFilterProps = {
  min: string
  max: string
  onChange: (min: string, max: string) => void
  /** Pill classes shared with the other Explore filters. */
  pillClass: string
  onClass: string
  offClass: string
}

const boxClass =
  'h-10 w-full rounded-[10px] border border-line-strong bg-white pr-2 pl-6 text-base text-ink outline-none focus:shadow-[var(--focus-ring)]'

export function CostRangeFilter({ min, max, onChange, pillClass, onClass, offClass }: CostRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [draftMin, setDraftMin] = useState(min)
  const [draftMax, setDraftMax] = useState(max)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const active = min !== '' || max !== ''

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  function toggle() {
    if (!open) {
      setDraftMin(min)
      setDraftMax(max)
    }
    setOpen((v) => !v)
  }

  function apply(nextMin: string, nextMax: string) {
    // Swap if typed the wrong way round.
    const lo = nextMin === '' ? '' : String(Math.max(0, Math.round(Number(nextMin))))
    const hi = nextMax === '' ? '' : String(Math.max(0, Math.round(Number(nextMax))))
    if (lo !== '' && hi !== '' && Number(lo) > Number(hi)) onChange(hi, lo)
    else onChange(lo, hi)
    setOpen(false)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    apply(draftMin, draftMax)
  }

  return (
    <div ref={rootRef} className="md:relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(pillClass, 'inline-flex items-center gap-1.5 pr-3 pl-3.5', active ? onClass : offClass)}
      >
        <span className="sr-only">Cost: </span>
        {costLabel(min, max)}
        <ChevronDown aria-hidden className="size-3.5 text-ink-2" />
      </button>

      {open ? (
        <form
          id={panelId}
          onSubmit={handleSubmit}
          aria-label="Cost per person"
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 rounded-t-[var(--radius-sheet)] border-t border-line bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-sheet)]',
            'md:absolute md:inset-x-auto md:top-full md:bottom-auto md:left-0 md:mt-2 md:w-80 md:rounded-card md:border md:pb-4 md:shadow-[var(--shadow-float)]',
          )}
        >
          <p className="m-0 text-base font-bold text-ink">Cost per person</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COST_PRESETS.map((preset) => {
              const on = preset.min === min && preset.max === max
              return (
                <button
                  key={preset.label}
                  type="button"
                  className="tab"
                  aria-pressed={on}
                  aria-selected={on}
                  onClick={() => apply(preset.min, preset.max)}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-2">Min</span>
              <span className="relative block">
                <span aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  placeholder="0"
                  value={draftMin}
                  onChange={(e) => setDraftMin(e.target.value)}
                  className={boxClass}
                />
              </span>
            </label>
            <span aria-hidden className="pb-2.5 text-muted-foreground">
              to
            </span>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-2">Max</span>
              <span className="relative block">
                <span aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  placeholder="Any"
                  value={draftMax}
                  onChange={(e) => setDraftMax(e.target.value)}
                  className={boxClass}
                />
              </span>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn btn--sm flex-1">
              Show trails
            </button>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => apply('', '')}>
              Any cost
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
