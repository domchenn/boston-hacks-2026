/**
 * Explore's Cost filter, styled like the other filter dropdowns (@/components/
 * Dropdown): a pill ("Any cost", "Free", "Under $25", "$10–$25", "$25+") that
 * opens a small panel with Min / Max dollar boxes and a Free toggle. Nothing to
 * press: changes apply as you type (after a short pause) and again when the
 * panel closes (click away, Esc, Enter), and a line in the panel says what's
 * showing. Values are whole dollars per person as strings ('' = no limit), kept
 * in the URL by ExplorePage (?cost_min=&cost_max=). On phones the panel is a
 * bottom sheet, since the filter row scrolls sideways.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { costLabel } from './filters'

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
  'h-9 w-full rounded-[8px] border border-line-strong bg-white pr-2 pl-6 text-sm text-ink outline-none focus:shadow-[var(--focus-ring)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** Whole dollars, '' for empty; swaps min/max if typed the wrong way round. */
function normalize(min: string, max: string): [string, string] {
  const lo = min.trim() === '' ? '' : String(Math.max(0, Math.round(Number(min))))
  const hi = max.trim() === '' ? '' : String(Math.max(0, Math.round(Number(max))))
  if (lo !== '' && hi !== '' && Number(lo) > Number(hi)) return [hi, lo]
  return [lo, hi]
}

/** "Showing trails up to $20", for the line in the panel. */
function showingText(min: string, max: string) {
  if (min === '' && max === '') return 'Showing trails at any cost'
  if (max === '0') return 'Showing free trails'
  if (min === '' || min === '0') return `Showing trails up to $${max}`
  if (max === '') return `Showing trails from $${min}`
  return `Showing trails from $${min} to $${max}`
}

export function CostRangeFilter({ min, max, onChange, pillClass, onClass, offClass }: CostRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [draftMin, setDraftMin] = useState(min)
  const [draftMax, setDraftMax] = useState(max)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const active = min !== '' || max !== ''
  const free = draftMax === '0' && (draftMin === '' || draftMin === '0')

  // Keep the latest values for the close handlers below.
  const latest = useRef({ draftMin, draftMax, min, max, onChange })
  useEffect(() => {
    latest.current = { draftMin, draftMax, min, max, onChange }
  })

  /** Apply the boxes if they changed. */
  function commit() {
    const { draftMin: dMin, draftMax: dMax, min: curMin, max: curMax, onChange: change } = latest.current
    const [lo, hi] = normalize(dMin, dMax)
    if (lo !== curMin || hi !== curMax) change(lo, hi)
  }

  function close(refocus = true) {
    commit()
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  // Apply as you type, after a short pause, so the trails update behind the panel.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(commit, 450)
    return () => clearTimeout(timer)
  }, [open, draftMin, draftMax])

  // Click away (or Esc) saves and closes.
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
    // close() only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle() {
    if (open) return close()
    setDraftMin(min)
    setDraftMax(max)
    setOpen(true)
  }

  function toggleFree() {
    if (free) {
      setDraftMin('')
      setDraftMax('')
    } else {
      setDraftMin('')
      setDraftMax('0')
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    close()
  }

  const [shownMin, shownMax] = normalize(draftMin, draftMax)

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Cost: ${costLabel(min, max)}`}
        onClick={toggle}
        className={cn(pillClass, 'inline-flex items-center gap-1.5 pr-3 pl-3.5', active ? onClass : offClass)}
      >
        {costLabel(min, max)}
        <ChevronDown aria-hidden className={cn('size-3.5 text-ink-2 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <>
          <div aria-hidden className="fixed inset-0 z-30 bg-ink/30 md:hidden" onClick={() => close(false)} />
          <form
            id={panelId}
            onSubmit={handleSubmit}
            aria-label="Cost per person"
            className={cn(
              'fixed inset-x-0 bottom-0 z-40 rounded-t-[var(--radius-sheet)] border-t border-line bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-sheet)]',
              'animate-in slide-in-from-bottom-4 fade-in duration-200 motion-reduce:animate-none',
              'md:absolute md:inset-x-auto md:top-full md:bottom-auto md:left-0 md:mt-1.5 md:w-64 md:overflow-hidden md:rounded-card md:border md:p-0 md:shadow-[var(--shadow-float)] md:slide-in-from-top-1',
            )}
          >
            <p className="m-0 pb-2 text-base font-bold text-ink md:hidden">Cost per person</p>

            {/* Free: a toggle row, like a dropdown option. */}
            <button
              type="button"
              role="switch"
              aria-checked={free}
              onClick={toggleFree}
              className={cn(
                'flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent py-3 text-left text-base text-ink hover:bg-paper md:px-4 md:py-2 md:text-sm',
                free && 'font-semibold',
              )}
            >
              Free
              {free ? <Check aria-hidden className="size-4 text-crumb-strong" /> : null}
            </button>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 pt-3 md:px-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Min</span>
                <span className="relative block">
                  <span aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9999}
                    placeholder="0"
                    value={free ? '' : draftMin}
                    onChange={(e) => {
                      setDraftMin(e.target.value)
                      if (free) setDraftMax('')
                    }}
                    className={boxClass}
                  />
                </span>
              </label>
              <span aria-hidden className="pb-2 text-sm text-muted-foreground">
                to
              </span>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Max</span>
                <span className="relative block">
                  <span aria-hidden className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9999}
                    placeholder="Any"
                    value={free ? '' : draftMax}
                    onChange={(e) => setDraftMax(e.target.value)}
                    className={boxClass}
                  />
                </span>
              </label>
            </div>
            {/* Lets Enter in a box close the panel. */}
            <button type="submit" hidden aria-hidden tabIndex={-1} />

            <p role="status" className="m-0 flex items-center gap-1.5 pt-3 text-xs text-muted-foreground md:px-4 md:pb-3">
              <Check aria-hidden className="size-3.5 text-done" />
              {showingText(shownMin, shownMax)}
            </p>
          </form>
        </>
      ) : null}
    </div>
  )
}
