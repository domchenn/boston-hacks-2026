/**
 * The Breadcrumb API client, or null when VITE_API_URL isn't set. Sends the signed-in
 * user's Supabase access token with each request, so the API applies the same RLS
 * as direct Supabase queries. Used by src/lib/api/trails.ts (getFeed, getTrail);
 * without VITE_API_URL those keep querying Supabase directly, which is how
 * production runs until the API is released there.
 *
 * The client (and Zod, which it uses to check responses) is loaded on first use as a
 * separate chunk, so builds without VITE_API_URL never download it.
 */
import type { ApiClient } from '@breadcrumb/contracts'
import { supabase } from '@/lib/supabase'

const baseUrl = import.meta.env.VITE_API_URL?.trim()
let client: Promise<ApiClient> | null = null

/** The API client when VITE_API_URL is set, otherwise null (use Supabase directly). */
export function getApi(): Promise<ApiClient> | null {
  if (!baseUrl) return null
  client ??= import('@breadcrumb/contracts').then(({ createApiClient }) =>
    createApiClient({
      baseUrl,
      // getSession refreshes an expired token first, so requests carry a valid one.
      getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    }),
  )
  return client
}
