/**
 * Data for Edit trail (/trails/:id/edit): load one of your trails into the Make a
 * trail form's draft, list what saving would drop, and Unpublish / Delete.
 *
 * Saving goes through save_trail() (./api), which REPLACES the stops and writes
 * one "do" crumb per stop. So anything the form can't hold (extra crumbs, crumbs
 * between stops, stop descriptions / planned activities / notes) is reported by
 * editLosses() and shown before saving, rather than silently lost. Unpublish and
 * Delete are plain updates/deletes on the trail row (RLS: creators only), so they
 * never touch stops or crumbs. No React here. Used by EditTrailPage.tsx.
 */
import { getTrail, type TrailDetail } from '@/lib/api/trails'
import { supabase } from '@/lib/supabase'
import { MAX_STOPS, type StopDraft, type TrailDraft } from './draft'

const NETWORK_ERROR = 'We couldn’t reach Breadcrumb. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'
const NOT_YOURS = 'This trail isn’t yours, or it no longer exists.'

/** supabase-js reports network failures as an error without a Postgres code. */
const messageFor = (error: { code?: string } | null | undefined) => (error?.code ? GENERIC_ERROR : NETWORK_ERROR)

export type EditableTrail = {
  trail: TrailDetail
  /** stop id → its place-library link and that place's neighborhood (getTrail doesn't return these). */
  library: Map<string, { experienceId: string | null; neighborhood: string | null }>
}

export type LoadResult =
  | { status: 'ok'; data: EditableTrail }
  | { status: 'not_found' }
  | { status: 'not_yours'; trail: TrailDetail }
  | { status: 'error'; message: string }

export async function loadEditableTrail(trailId: string, userId: string): Promise<LoadResult> {
  try {
    const trail = await getTrail(trailId)
    if (!trail) return { status: 'not_found' }
    if (trail.creator?.id !== userId) return { status: 'not_yours', trail }

    const { data, error } = await supabase
      .from('sidequest_stops')
      .select('id, experience_id, experiences(neighborhood)')
      .eq('sidequest_id', trailId)
    if (error) return { status: 'error', message: messageFor(error) }
    const library = new Map(
      data.map((row) => [row.id, { experienceId: row.experience_id, neighborhood: row.experiences?.neighborhood ?? null }]),
    )
    return { status: 'ok', data: { trail, library } }
  } catch (error) {
    return { status: 'error', message: messageFor(error as { code?: string }) }
  }
}

/** ISO time → the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in the user's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The Make a trail form's draft for an existing trail. */
export function draftFromTrail({ trail, library }: EditableTrail): TrailDraft {
  const stops = trail.stops.map<StopDraft>((stop, i) => {
    const lib = library.get(stop.id)
    return {
      key: stop.id,
      experienceId: lib?.experienceId ?? null,
      placeName: stop.placeName,
      address: stop.address ?? '',
      latitude: stop.latitude,
      longitude: stop.longitude,
      // save_trail takes the trail's neighborhood from the first stop; keep the current one.
      neighborhood: lib?.neighborhood ?? (i === 0 ? trail.neighborhood : null),
      estimatedCost: stop.estimatedCost,
      travelMode: stop.travelModeToStop ?? 'walk',
      crumb: stop.crumbs[0]?.label ?? '',
    }
  })
  return {
    title: trail.title,
    description: trail.description ?? '',
    category: trail.category,
    when: trail.scheduledAt ? 'scheduled' : 'anytime',
    scheduledLocal: trail.scheduledAt ? toLocalInput(trail.scheduledAt) : '',
    durationMinutes: trail.estimatedMinutes,
    stops,
  }
}

export type EditLosses = {
  /** Crumbs beyond the first at a stop. */
  extraCrumbs: number
  /** Crumbs that aren't at a stop ("along the way"). */
  betweenCrumbs: number
  /** First crumbs marked "See", which save as "Do". */
  seeCrumbs: number
  /** Stops with a description, planned activity or notes. */
  stopsWithDetails: number
  /** More stops than the form allows. */
  tooManyStops: boolean
  /** The trail's cost, recalculated from its stops on save, if that changes it. */
  costChange: { from: number | null; to: number | null } | null
}

/** What saving from the editor would change beyond the user's own edits. */
export function editLosses(trail: TrailDetail): EditLosses {
  const stops = trail.stops
  // Same sum suggestedCost() makes when saving: known stop costs, or null if none are known.
  const known = stops.map((s) => s.estimatedCost).filter((c): c is number => c !== null)
  const cost = known.length ? known.reduce((x, y) => x + y, 0) : null
  const sameCost =
    (cost === null && trail.estimatedCost === null) ||
    (cost !== null && trail.estimatedCost !== null && Math.round(cost) === Math.round(trail.estimatedCost))
  return {
    extraCrumbs: stops.reduce((n, s) => n + Math.max(0, s.crumbs.length - 1), 0),
    betweenCrumbs: trail.betweenStopCrumbs.length,
    seeCrumbs: stops.filter((s) => s.crumbs[0]?.type === 'see').length,
    stopsWithDetails: stops.filter((s) => s.description || s.plannedActivity || s.notes).length,
    tooManyStops: stops.length > MAX_STOPS,
    costChange: sameCost ? null : { from: trail.estimatedCost, to: cost },
  }
}

export type ActionResult = { ok: true } | { ok: false; message: string }

/** Back to draft: hidden from everyone but you. Stops and crumbs are untouched. */
export async function unpublishTrail(trailId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.from('sidequests').update({ status: 'draft' }).eq('id', trailId).select('id')
    if (error) return { ok: false, message: messageFor(error) }
    return data.length > 0 ? { ok: true } : { ok: false, message: NOT_YOURS }
  } catch {
    return { ok: false, message: NETWORK_ERROR }
  }
}

/** Deletes the trail for good: its stops, crumbs, everyone's progress and ratings go with it. */
export async function deleteTrail(trailId: string): Promise<ActionResult> {
  try {
    const { data, error } = await supabase.from('sidequests').delete().eq('id', trailId).select('id')
    if (error) return { ok: false, message: messageFor(error) }
    return data.length > 0 ? { ok: true } : { ok: false, message: NOT_YOURS }
  } catch {
    return { ok: false, message: NETWORK_ERROR }
  }
}
