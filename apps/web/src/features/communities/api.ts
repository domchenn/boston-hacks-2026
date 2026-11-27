/**
 * Communities (BU / BC): the list, and joining one (or none) via
 * profiles.community_id. A user belongs to at most one community; trails limited
 * to a community are hidden from everyone else by RLS. Used by the Explore
 * switcher, the You page setting and Make a trail's "Who can see this" (task G6).
 * With VITE_API_URL set, both go through the API (GET /v1/communities and
 * PUT /v1/me/community, which only ever changes the caller's own profile).
 */
import { useEffect, useState } from 'react'
import { getApi } from '@/lib/apiClient'
import { supabase } from '@/lib/supabase'

export type Community = { id: string; name: string; slug: string }

/**
 * Communities are switched off in the UI for now (team decision): the Explore
 * switcher, the You page setting and Make a trail's "Who can see this" are
 * hidden. The data, RLS and code stay; set this to true to bring them back.
 */
export const SHOW_COMMUNITIES = false

const NETWORK_ERROR = 'We couldn’t reach Breadcrumb. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong. Please try again.'

/** Short label for pills: the slug in capitals ("BU"), else the name. */
export const shortName = (c: Pick<Community, 'name' | 'slug'>) => (c.slug ? c.slug.toUpperCase() : c.name)

let cache: Promise<Community[]> | null = null

/** Every community, by name. Cached for the session (they rarely change). */
export function listCommunities(): Promise<Community[]> {
  const api = getApi()
  if (api) cache ??= api.then((client) => client.getCommunities())
  cache ??= Promise.resolve(supabase.from('communities').select('id, name, slug').order('name')).then(
    ({ data, error }) => {
      if (error) throw error
      return (data ?? []).filter((c): c is Community => c.slug !== null)
    },
  )
  // Don't keep a failed request around; let the next caller retry.
  cache.catch(() => {
    cache = null
  })
  return cache
}

/** The communities list for components; `null` while loading, `[]` if it failed. */
export function useCommunities(): Community[] | null {
  const [communities, setCommunities] = useState<Community[] | null>(null)
  useEffect(() => {
    let cancelled = false
    listCommunities().then(
      (list) => !cancelled && setCommunities(list),
      () => !cancelled && setCommunities([]),
    )
    return () => {
      cancelled = true
    }
  }, [])
  return communities
}

export type SaveResult = { ok: true } | { ok: false; message: string }

/** Join a community (or leave by passing null). Updates only your own profile row. */
export async function setMyCommunity(userId: string, communityId: string | null): Promise<SaveResult> {
  const api = getApi()
  if (api) {
    try {
      await (await api).setMyCommunity(communityId)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error && 'status' in error ? GENERIC_ERROR : NETWORK_ERROR }
    }
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ community_id: communityId })
      .eq('id', userId)
      .select('id')
    if (error) return { ok: false, message: error.code ? GENERIC_ERROR : NETWORK_ERROR }
    return data.length > 0 ? { ok: true } : { ok: false, message: GENERIC_ERROR }
  } catch {
    return { ok: false, message: NETWORK_ERROR }
  }
}
