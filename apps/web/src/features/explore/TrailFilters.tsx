/**
 * The trail filter row shared by Explore (For you) and the Map tab: Category,
 * Neighborhood, Cost (CostRangeFilter), Length, Late night, Near a T station and
 * "Clear filters". Values live in the URL (./filters), so a filtered view can be
 * shared and survives refresh; this component reads them from `params` and writes
 * changes with `setParams` (replacing the history entry, so Back leaves the page).
 * Phones: one row that scrolls sideways. Wider screens: wraps.
 * The neighborhood menu lists places that have at least one trail (loadNeighborhoods).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Check, Moon, TrainFront } from 'lucide-react'
import type { SetURLSearchParams } from 'react-router'
import { Dropdown } from '@/components/Dropdown'
import { cn } from '@/lib/utils'
import { loadNeighborhoods, NEAR_T_MILES } from './api'
import { CostRangeFilter } from './CostRangeFilter'
import {
  activeFilterCount,
  CATEGORY_OPTIONS,
  LENGTH_OPTIONS,
  readFilterValues,
  withFilter,
  withoutFilters,
  type FilterKey,
} from './filters'

const pill =
  'h-11 cursor-pointer rounded-pill bg-white text-sm font-semibold outline-none transition-shadow focus-visible:shadow-[var(--focus-ring)] md:h-[38px]'
const pillOff = 'text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-ink-2)]'
const pillOn = 'text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]'

/** A filter chip: our Dropdown styled as an outlined pill (no native <select>). */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Dropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      buttonClassName={cn(pill, 'max-w-[13rem] pr-3 pl-3.5', value !== '' ? pillOn : pillOff)}
    />
  )
}

/** An on/off quick filter (Late night, Near a T station), same pill look as the selects. */
function FilterToggle({
  label,
  icon,
  on,
  title,
  onChange,
}: {
  label: string
  icon: ReactNode
  on: boolean
  title?: string
  onChange: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={() => onChange(!on)}
      className={cn(pill, 'inline-flex items-center gap-1.5 px-3.5 [&_svg]:size-4', on ? pillOn : pillOff)}
    >
      {on ? <Check aria-hidden /> : icon}
      {label}
    </button>
  )
}

type TrailFiltersProps = {
  params: URLSearchParams
  setParams: SetURLSearchParams
  /** Extra filters this page counts (e.g. Explore's community); shows "Clear filters" when > 0. */
  extraActive?: number
  /** Replaces the default clear (all filter keys) when the page has more to clear. */
  onClear?: () => void
  className?: string
}

export function TrailFilters({ params, setParams, extraActive = 0, onClear, className }: TrailFiltersProps) {
  const values = readFilterValues(params)
  const activeCount = activeFilterCount(params) + extraActive
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    // Only fills the neighborhood menu; if it fails the menu just has "Any neighborhood".
    loadNeighborhoods().then(
      (names) => !cancelled && setNeighborhoods(names),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  // A shared link may name a neighborhood with no trails right now; keep it selectable.
  const neighborhoodNames =
    values.neighborhood && !neighborhoods.includes(values.neighborhood)
      ? [values.neighborhood, ...neighborhoods]
      : neighborhoods
  const neighborhoodOptions = [
    { value: '', label: 'Any neighborhood' },
    ...neighborhoodNames.map((n) => ({ value: n, label: n })),
  ]

  const setFilter = (k: FilterKey, value: string) => setParams(withFilter(params, k, value), { replace: true })
  const setCost = (min: string, max: string) =>
    setParams(withFilter(withFilter(withFilter(params, 'cost_min', min), 'cost_max', max), 'cost', ''), { replace: true })
  const clear = onClear ?? (() => setParams(withoutFilters(params), { replace: true }))

  return (
    <div
      role="group"
      aria-label="Filters"
      className={cn(
        'flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden [&>*]:shrink-0',
        className,
      )}
    >
      <FilterSelect
        label="Category"
        value={values.category}
        options={CATEGORY_OPTIONS}
        onChange={(v) => setFilter('category', v)}
      />
      <FilterSelect
        label="Neighborhood"
        value={values.neighborhood}
        options={neighborhoodOptions}
        onChange={(v) => setFilter('neighborhood', v)}
      />
      <CostRangeFilter
        min={values.cost_min}
        max={values.cost_max}
        onChange={setCost}
        pillClass={pill}
        onClass={pillOn}
        offClass={pillOff}
      />
      <FilterSelect
        label="Length"
        value={values.length}
        options={LENGTH_OPTIONS}
        onChange={(v) => setFilter('length', v)}
      />
      <FilterToggle
        label="Late night"
        icon={<Moon aria-hidden />}
        on={values.late === '1'}
        title="At least one stop is open late"
        onChange={(on) => setFilter('late', on ? '1' : '')}
      />
      <FilterToggle
        label="Near a T station"
        icon={<TrainFront aria-hidden />}
        on={values.near_t === '1'}
        title={`Every stop is within ${NEAR_T_MILES} mi of a T station (straight line)`}
        onChange={(on) => setFilter('near_t', on ? '1' : '')}
      />
      {activeCount > 0 ? (
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-11 cursor-pointer items-center rounded-pill border-0 bg-transparent px-2 text-sm font-semibold text-crumb-strong hover:text-crumb-deep hover:underline md:h-[38px]"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
