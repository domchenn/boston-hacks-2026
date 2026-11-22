/**
 * TypeScript types for Vite and for the VITE_* environment variables read
 * through import.meta.env. Add a line here when you add a new VITE_ variable.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Browser key for Google Maps JS + Directions (optional: without it, maps show a stop list). */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Optional MBTA V3 API key (raises the rate limit from 20 to 1000 requests/min). */
  readonly VITE_MBTA_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
