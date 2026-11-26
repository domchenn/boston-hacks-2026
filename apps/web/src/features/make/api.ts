/**
 * Data calls for the Make a trail page: save a trail through the save_trail()
 * database function, which writes the trail, its stops and crumbs in one
 * transaction. (Places come from Google search: ./googlePlaces.) With VITE_API_URL set,
 * the same payload goes through the API (POST /v1/trails, PUT /v1/trails/:id), which
 * calls save_trail() as the same user and passes its messages back.
 */

import { getApi } from '@/lib/apiClient'
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
  const api = getApi()
  if (api) return saveViaApi(await api, draft, status, trailId)

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

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again."
const GENERIC_MESSAGE = 'Something went wrong saving your trail. Please try again.'

/** The API path: same payload and the same messages as the direct save_trail() call above. */
async function saveViaApi(
  api: NonNullable<Awaited<ReturnType<typeof getApi>>>,
  draft: TrailDraft,
  status: 'draft' | 'published',
  trailId: string | null,
): Promise<SaveResult> {
  const payload = toSavePayload(draft, status)
  try {
    const { id } = trailId ? await api.updateTrail(trailId, payload) : await api.createTrail(payload)
    return { ok: true, id }
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? Number((error as { status: unknown }).status) : 0
    // 422 / 403 carry save_trail()'s own message ("Add at least 2 stops before publishing").
    if (status === 422 || status === 403) return { ok: false, message: (error as Error).message }
    if (!status) return { ok: false, message: NETWORK_MESSAGE }
    console.error('[make] save failed', error)
    return { ok: false, message: GENERIC_MESSAGE }
  }
}
