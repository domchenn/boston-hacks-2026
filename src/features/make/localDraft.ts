/**
 * Keeps the Make a trail form on this device while you work, so a refresh or a
 * closed tab doesn't lose what you typed. One trail-in-progress per signed-in
 * user, in localStorage (it never leaves the browser). Cleared when you publish
 * or tap "Start over". Includes the trail's id once "Save draft" has saved it,
 * so later saves update that draft instead of making a copy.
 * Used by MakeTrailForm on /make only (not Edit trail or Remix).
 */

import type { TrailDraft } from './draft'

const KEY = 'breadcrumb:make-trail:v1'

type Stored = { userId: string; trailId: string | null; draft: TrailDraft }

/** True when nothing worth keeping has been entered yet. */
export function isEmptyDraft(draft: TrailDraft) {
  return draft.title.trim() === '' && draft.description.trim() === '' && draft.stops.length === 0
}

/** The saved trail-in-progress for this user, or null (none, someone else's, or unreadable). */
export function readLocalDraft(userId: string): { trailId: string | null; draft: TrailDraft } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored
    if (stored?.userId !== userId || typeof stored.draft?.title !== 'string' || !Array.isArray(stored.draft.stops)) return null
    return { trailId: stored.trailId ?? null, draft: stored.draft }
  } catch {
    return null
  }
}

export function writeLocalDraft(userId: string, draft: TrailDraft, trailId: string | null) {
  try {
    if (isEmptyDraft(draft) && !trailId) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify({ userId, trailId, draft } satisfies Stored))
  } catch {
    // Storage full or blocked (private mode): the form still works, it just won't survive a refresh.
  }
}

export function clearLocalDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
