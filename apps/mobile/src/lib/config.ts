/**
 * App settings from EXPO_PUBLIC_ environment variables, which Expo builds into the app
 * (so only public values: the API address). Each must be written out literally as
 * process.env.EXPO_PUBLIC_…, or Expo won't fill it in. Copy .env.example to .env.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || null

export const config = {
  /** The Breadcrumb API (the staging API in development); null when not set. */
  apiUrl,
} as const
