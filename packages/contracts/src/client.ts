/**
 * Typed client for the Breadcrumb API, usable from the web app and (later) Expo.
 * Sends the caller's Supabase access token, encodes filters as query parameters,
 * validates every response against the contract and turns error responses into
 * ApiError. Pass `fetch` explicitly in tests or non-browser runtimes.
 */
import type { z } from 'zod'
import { ApiErrorBody } from './errors.js'
import { TrailDetail, TrailList, type TrailListFilters } from './trails.js'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export type ApiClientOptions = {
  /** e.g. https://api.breadcrumb.boston (no trailing slash needed). */
  baseUrl: string
  /** Returns the current Supabase access token, or null when signed out. */
  getAccessToken?: () => Promise<string | null> | string | null
  fetch?: typeof fetch
}

export type ApiClient = ReturnType<typeof createApiClient>

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch

  async function get<T extends z.ZodType>(path: string, schema: T, allowNotFound: true): Promise<z.infer<T> | null>
  async function get<T extends z.ZodType>(path: string, schema: T, allowNotFound?: false): Promise<z.infer<T>>
  async function get<T extends z.ZodType>(path: string, schema: T, allowNotFound = false): Promise<z.infer<T> | null> {
    const headers: Record<string, string> = { accept: 'application/json' }
    const token = await options.getAccessToken?.()
    if (token) headers.authorization = `Bearer ${token}`

    const response = await doFetch(`${baseUrl}${path}`, { headers })
    const requestId = response.headers.get('x-request-id')
    if (allowNotFound && response.status === 404) return null

    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const parsed = ApiErrorBody.safeParse(body)
      throw parsed.success
        ? new ApiError(response.status, parsed.data.error, parsed.data.message, parsed.data.requestId)
        : new ApiError(response.status, 'http_error', `Request failed with status ${response.status}.`, requestId)
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new ApiError(response.status, 'invalid_response', `Unexpected response from ${path}.`, requestId)
    }
    return parsed.data
  }

  return {
    /** Published trails the caller may see, newest first. */
    async getTrails(filters: TrailListFilters = {}) {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) query.set(key, String(value))
      }
      const search = query.size > 0 ? `?${query}` : ''
      return (await get(`/v1/trails${search}`, TrailList)).trails
    },

    /** One trail, or null if it doesn't exist or the caller may not see it. */
    getTrail(id: string) {
      return get(`/v1/trails/${encodeURIComponent(id)}`, TrailDetail, true)
    },
  }
}
