/**
 * How the app words trail facts, matching the website (apps/web/src/components/
 * trailFormat.ts): short category names, cost ("~$25" / "Free"), length ("2.5 hr") and
 * how you get to a stop. Used by TrailRow and the trail pages.
 */
import type { Category, TravelMode } from '@breadcrumb/contracts'

const CATEGORY_LABELS: Record<Category, string> = {
  food_drink: 'Food',
  outdoors: 'Outdoors',
  arts_culture: 'Arts',
  shopping: 'Shopping',
  attractions: 'Sights',
  affordable: 'Budget',
  other: 'Other',
}

/** The creator's own category when they typed one, else the short label. */
export function categoryLabel(category: Category | null, custom?: string | null): string | null {
  if (!category) return null
  if (category === 'other' && custom?.trim()) return custom.trim()
  return CATEGORY_LABELS[category]
}

/** 0 → "Free", 24.5 → "~$25". */
export function formatCost(cost: number): string {
  return cost <= 0 ? 'Free' : `~$${Math.round(cost)}`
}

/** 45 → "45 min", 90 → "1.5 hr", 120 → "2 hr" (rounded to the half hour). */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.round(minutes / 30) / 2} hr`
}

/** The stored way to reach a stop. No times: we only know the mode, not the route. */
export const TRAVEL_LABELS: Record<TravelMode, string> = {
  walk: 'Walk here',
  bike: 'Bike here',
  bus: 'Bus here',
  train: 'Take the T here',
}

/** "3 stops" / "1 stop". */
export function stopCount(count: number): string {
  return `${count} ${count === 1 ? 'stop' : 'stops'}`
}
