/**
 * Explore's filters live in the URL so a filtered feed can be shared:
 *   /?category=food_drink&neighborhood=North%20End&cost_min=10&cost_max=25&length=120&late=1&near_t=1&q=pizza
 * (Old links with ?cost=20 still work: it's read as "up to $20".)
 * readFilters() turns the query string into ExploreFilters (ignoring values it doesn't
 * know); withFilter() returns new params with one filter changed. Used by ExplorePage
 * and the Map tab (both through TrailFilters) and the header search (which keeps the
 * filters when you search).
 */

import { CATEGORY_LABELS } from '@/components/trailFormat'
import type { Category } from '@/types/db-values'
import type { ExploreFilters } from './api'

export const CATEGORY_OPTIONS = [
  { value: '', label: 'Any category' },
  ...(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => ({ value, label })),
]

/** "$10–$25", "Under $20", "$25+", "Free" or "Any cost", for the Cost pill. */
export function costLabel(min: string, max: string) {
  if (min === '' && max === '') return 'Any cost'
  if (max === '0') return 'Free'
  if (min === '' || min === '0') return `Under $${max}`
  if (max === '') return `$${min}+`
  return `$${min}–$${max}`
}

/** A whole number of dollars from the URL, or '' if it isn't one. */
const dollars = (value: string | null) => (value !== null && /^\d{1,4}$/.test(value) ? String(Number(value)) : '')

export const LENGTH_OPTIONS = [
  { value: '', label: 'Any length' },
  { value: '60', label: 'Up to 1 hr' },
  { value: '120', label: 'Up to 2 hr' },
  { value: '180', label: 'Up to 3 hr' },
]

/** The query-string names of every Explore filter (q is the header search). */
export const FILTER_KEYS = ['category', 'neighborhood', 'cost_min', 'cost_max', 'length', 'late', 'near_t'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

const known = (options: { value: string }[], value: string | null) =>
  value !== null && value !== '' && options.some((o) => o.value === value) ? value : ''

/** The filter values as the controls show them ('' = not set). Unknown values are dropped. */
export function readFilterValues(params: URLSearchParams): Record<FilterKey, string> {
  return {
    category: known(CATEGORY_OPTIONS, params.get('category')),
    neighborhood: params.get('neighborhood')?.trim() ?? '',
    cost_min: dollars(params.get('cost_min')),
    cost_max: dollars(params.get('cost_max') ?? params.get('cost')),
    length: known(LENGTH_OPTIONS, params.get('length')),
    late: params.get('late') === '1' ? '1' : '',
    near_t: params.get('near_t') === '1' ? '1' : '',
  }
}

/** How many filters are on in these params (the header search q isn't a filter). */
export function activeFilterCount(params: URLSearchParams) {
  const values = readFilterValues(params)
  return FILTER_KEYS.filter((k) => values[k] !== '').length
}

/** The same values as filters for loadTrails(). */
export function toExploreFilters(values: Record<FilterKey, string>): ExploreFilters {
  return {
    category: (values.category || undefined) as Category | undefined,
    neighborhood: values.neighborhood || undefined,
    minCost: values.cost_min === '' ? undefined : Number(values.cost_min),
    maxCost: values.cost_max === '' ? undefined : Number(values.cost_max),
    maxMinutes: values.length === '' ? undefined : Number(values.length),
    lateNight: values.late === '1' || undefined,
    nearT: values.near_t === '1' || undefined,
  }
}

/** A copy of `params` with one filter set (or removed when value is ''). */
export function withFilter(
  params: URLSearchParams,
  key: FilterKey | 'q' | 'community' | 'cost' | 'tab' | 'radius',
  value: string,
) {
  const next = new URLSearchParams(params)
  if (value) next.set(key, value)
  else next.delete(key)
  return next
}

/** A copy of `params` with every filter removed (the search is kept). */
export function withoutFilters(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  for (const key of FILTER_KEYS) next.delete(key)
  next.delete('cost') // the old single "up to" cost filter
  return next
}
