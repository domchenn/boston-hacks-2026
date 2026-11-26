/**
 * Data calls for the Make a trail page: save a trail through the save_trail()
 * database function, which writes the trail, its stops and crumbs in one
 * transaction. (Places come from Google search: ./googlePlaces.)
 */

import { supabase } from '@/lib/supabase'
import { toSavePayload, type TrailDraft } from './draft'

export type SaveResult = { ok: true; id: string } | { ok: false; message: string }

/**
 * Creates the trail (trailId null) or updates it. Returns the trail id, or a
 * message to show. save_trail() raises friendly messages for checklist problems
 * ("Add at least 2 stops before publishing"), which are passed through.
 */
export async function saveTrail(
  draft: TrailDraft,
  status: 'draft' | 'published',
  trailId: string | null,
): Promise<SaveResult> {
  const { data, error } = await supabase.rpc('save_trail', {
    p_trail: toSavePayload(draft, status),
    ...(trailId ? { p_trail_id: trailId } : {}),
  })
  if (!error && data) return { ok: true, id: data }
  if (error?.code === '23514' || error?.code === '42501') return { ok: false, message: error.message }
  if (error?.message?.toLowerCase().includes('fetch')) {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." }
  }
  console.error('[make] save failed', error)
  return { ok: false, message: 'Something went wrong saving your trail. Please try again.' }
}
