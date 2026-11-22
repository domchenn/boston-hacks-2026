/**
 * The Make a trail form's data: what a trail-in-progress looks like, the
 * "Ready to publish" checklist, the suggested cost/time, and how the form turns
 * into the JSON that save_trail() expects. No React here, so it's easy to test.
 */

import type { CrewStatus } from '@/lib/api/crew'
import type { TrailCreator } from '@/lib/api/trails'
import type { Category, TrailVisibility, TravelMode } from '@/types/db-values'

export const MIN_STOPS = 2
export const MAX_STOPS = 8

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'food_drink', label: 'Food & drink' },
  { value: 'outdoors', label: 'Outdoors' },
  { value: 'arts_culture', label: 'Arts & culture' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'attractions', label: 'Sights' },
  { value: 'affordable', label: 'Budget' },
]

export const TRAVEL_OPTIONS: { value: TravelMode; label: string }[] = [
  { value: 'walk', label: 'Walk' },
  { value: 'train', label: 'T (subway)' },
  { value: 'bus', label: 'Bus' },
  { value: 'bike', label: 'Bike' },
]

export const VISIBILITY_OPTIONS: { value: TrailVisibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Everyone', hint: 'Anyone on Breadcrumb can find it.' },
  { value: 'friends', label: 'Friends', hint: 'Only people you follow who follow you back.' },
  { value: 'close_friends', label: 'Close friends', hint: 'Only friends on your close friends list (on your profile).' },
]

export type StopDraft = {
  /** Local id for React keys and reordering (not a database id). */
  key: string
  /** Set when the stop was picked from the curated place library. */
  experienceId: string | null
  placeName: string
  address: string
  latitude: number | null
  longitude: number | null
  neighborhood: string | null
  /** Rough cost per person from the library, if known. */
  estimatedCost: number | null
  /** How to get here from the previous stop (ignored for the first stop). */
  travelMode: TravelMode
  /** The small task at this stop (optional; '' = none). */
  crumb: string
}

export type TrailDraft = {
  title: string
  description: string
  category: Category | null
  /** Minutes; null = use the suggestion. */
  durationMinutes: number | null
  /** Who can see it: null = everyone, else only this community (task G6). */
  communityId: string | null
  /** Who can see it: everyone, friends (mutual follows) or close friends. */
  visibility: TrailVisibility
  /** Remix (task G8): the trail this one is copied from. Only used when creating. */
  remixedFrom: string | null
  stops: StopDraft[]
  /** Original Crew: friends tagged as being there (saved separately with setTrailCrew). */
  crew: CrewPick[]
}

/** A tagged friend; status is null until the trail is saved with them on it. */
export type CrewPick = { person: TrailCreator; status: CrewStatus | null }

export const emptyDraft = (): TrailDraft => ({
  title: '',
  description: '',
  category: null,
  durationMinutes: null,
  communityId: null,
  visibility: 'public',
  remixedFrom: null,
  stops: [],
  crew: [],
})

/** Sum of the stops' known costs, or null if none are known. */
export function suggestedCost(stops: StopDraft[]): number | null {
  const known = stops.map((s) => s.estimatedCost).filter((c): c is number => c !== null)
  return known.length ? known.reduce((a, b) => a + b, 0) : null
}

/** A rough visit-time suggestion (about 45 min per stop, rounded to 30 min). The user can change it. */
export function suggestedMinutes(stopCount: number): number | null {
  if (stopCount === 0) return null
  return Math.max(30, Math.round((stopCount * 45) / 30) * 30)
}

export type ChecklistKey = 'basics' | 'stops'
export type ChecklistItem = { key: ChecklistKey; label: string; done: boolean }

/** The "Ready to publish" list. Publishing is allowed when every item is done. Crumbs are optional. */
export function publishChecklist(draft: TrailDraft): ChecklistItem[] {
  return [
    { key: 'basics', label: 'A name and a category', done: draft.title.trim() !== '' && draft.category !== null },
    { key: 'stops', label: `At least ${MIN_STOPS} stops`, done: draft.stops.length >= MIN_STOPS },
  ]
}

export const canPublish = (draft: TrailDraft) => publishChecklist(draft).every((item) => item.done)

/** The JSON body for save_trail() (see its migration for the shape). */
export function toSavePayload(draft: TrailDraft, status: 'draft' | 'published') {
  const cost = suggestedCost(draft.stops)
  const minutes = draft.durationMinutes ?? suggestedMinutes(draft.stops.length)
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    category: draft.category,
    // Trails are go-anytime: saving clears any date an old trail had.
    scheduled_at: null,
    status,
    estimated_cost: cost,
    estimated_duration_minutes: minutes,
    neighborhood: draft.stops[0]?.neighborhood ?? null,
    community_id: draft.communityId,
    visibility: draft.visibility,
    remixed_from: draft.remixedFrom,
    stops: draft.stops.map((s, i) => ({
      experience_id: s.experienceId,
      place_name: s.placeName.trim(),
      address: s.address.trim() || null,
      latitude: s.latitude,
      longitude: s.longitude,
      travel_mode_to_stop: i === 0 ? null : s.travelMode,
      estimated_cost: s.estimatedCost,
      crumb: s.crumb.trim(),
    })),
  }
}
