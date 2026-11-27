/**
 * The Breadcrumb API client for the app: the same typed client as the website
 * (@breadcrumb/contracts), pointed at EXPO_PUBLIC_API_URL. Every request carries the
 * signed-in user's access token, read from the Supabase session (supabase-js refreshes
 * it first when it's about to expire). Null when the API address isn't configured.
 */
import { createApiClient, type ApiClient } from '@breadcrumb/contracts'
import { config } from './config'
import { supabase } from './supabase'

export const api: ApiClient | null = config.apiUrl
  ? createApiClient({
      baseUrl: config.apiUrl,
      getAccessToken: async () => (supabase ? ((await supabase.auth.getSession()).data.session?.access_token ?? null) : null),
    })
  : null

/** The HTTP status of an API error, or 0 when the request never got an answer. */
export function statusOf(error: unknown): number {
  return error instanceof Error && 'status' in error ? Number((error as { status: unknown }).status) : 0
}
