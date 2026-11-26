/**
 * "You both saved this": which friends (mutual follows) saved the same trails as
 * you, from friends_also_saved() (only shared saves, never a friend's other
 * saves). useFriendsAlsoSaved() loads it once per visit as a map of trail id →
 * friends, newest first. Used by the Saved page and Explore → Friends.
 */

import { useEffect, useState } from 'react'
import type { TrailCreator } from '@/lib/api/trails'
import { supabase } from '@/lib/supabase'

export type AlsoSaved = Map<string, TrailCreator[]>

export async function loadFriendsAlsoSaved(): Promise<AlsoSaved> {
  const { data, error } = await supabase.rpc('friends_also_saved')
  if (error) throw error
  const map: AlsoSaved = new Map()
  for (const row of data ?? []) {
    const friend = { id: row.friend_id, username: row.username, display_name: row.display_name, avatar_url: row.avatar_url }
    map.set(row.sidequest_id, [...(map.get(row.sidequest_id) ?? []), friend])
  }
  return map
}

/** The map, or null while loading. Decoration only: on an error it's just empty. */
export function useFriendsAlsoSaved(viewerId: string | null, refreshKey: unknown = 0) {
  const [result, setResult] = useState<{ key: string; map: AlsoSaved } | null>(null)
  const key = viewerId ? `${viewerId}|${String(refreshKey)}` : null

  useEffect(() => {
    if (!key) return
    let cancelled = false
    loadFriendsAlsoSaved().then(
      (map) => !cancelled && setResult({ key, map }),
      () => !cancelled && setResult({ key, map: new Map() }),
    )
    return () => {
      cancelled = true
    }
  }, [key])

  return result?.key === key ? result.map : null
}
