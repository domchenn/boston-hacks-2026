/**
 * Explore's filters live in the URL so a filtered feed can be shared:
 *   /?category=food_drink&neighborhood=North%20End&cost=20&length=120&late=1&near_t=1&q=pizza
 * readFilters() turns the query string into ExploreFilters (ignoring values it doesn't
 * know); withFilter() returns new params with one filter changed. Used by ExplorePage
 * and the header search (which keeps the filters when you search).
 */

import { CATEGORY_LABELS } from '@/components/trailFormat'
import type { Category } from '@/types/db-values'
import type { ExploreFilters } from './api'

export const CATEGORY_OPTIONS = [
  { value: '', label: 'Any category' },
  ...(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => ({ value, label })),
]

export const COST_OPTIONS = [
  { value: '', label: 'Any cost' },
  { value: '0', label: 'Free' },
  { value: '10', label: 'Under $10' },
  { value: '20', label: 'Under $20' },
  { value: '35', label: 'Under $35' },
]

export const LENGTH_OPTIONS = [
  { value: '', label: 'Any length' },
  { value: '60', label: 'Up to 1 hr' },
  { value: '120', label: 'Up to 2 hr' },
  { value: '180', label: 'Up to 3 hr' },
]

/** The query-string names of every Explore filter (q is the header search). */
export const FILTER_KEYS = ['category', 'neighborhood', 'cost', 'length', 'late', 'near_t'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

const known = (options: { value: string }[], value: string | null) =>
  value !== null && value !== '' && options.some((o) => o.value === value) ? value : ''

/** The filter values as the controls show them ('' = not set). Unknown values are dropped. */
export function readFilterValues(params: URLSearchParams): Record<FilterKey, string> {
  return {
    category: known(CATEGORY_OPTIONS, params.get('category')),
    neighborhood: params.get('neighborhood')?.trim() ?? '',
    cost: known(COST_OPTIONS, params.get('cost')),
    length: known(LENGTH_OPTIONS, params.get('length')),
    late: params.get('late') === '1' ? '1' : '',
    near_t: params.get('near_t') === '1' ? '1' : '',
  }
}

/** The same values as filters for loadTrails(). */
export function toExploreFilters(values: Record<FilterKey, string>): ExploreFilters {
  return {
    category: (values.category || undefined) as Category | undefined,
    neighborhood: values.neighborhood || undefined,
    maxCost: values.cost === '' ? undefined : Number(values.cost),
    maxMinutes: values.length === '' ? undefined : Number(values.length),
    lateNight: values.late === '1' || undefined,
    nearT: values.near_t === '1' || undefined,
  }
}

/** A copy of `params` with one filter set (or removed when value is ''). */
export function withFilter(params: URLSearchParams, key: FilterKey | 'q', value: string) {
  const next = new URLSearchParams(params)
  if (value) next.set(key, value)
  else next.delete(key)
  return next
}

/** A copy of `params` with every filter removed (the search is kept). */
export function withoutFilters(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  for (const key of FILTER_KEYS) next.delete(key)
  return next
}
