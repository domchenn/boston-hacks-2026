/**
 * Typed client for the Breadcrumb API, usable from the web app and (later) Expo.
 * Sends the caller's Supabase access token, encodes filters as query parameters,
 * validates every response against the contract and turns error responses into
 * ApiError. Pass `fetch` explicitly in tests or non-browser runtimes.
 */
import type { z } from 'zod'
import { ApiErrorBody } from './errors.js'
import {
  ProfileStats,
  ProfileTrailList,
  PublicProfile,
  SavedTrailList,
  type MyTrailsQuery,
} from './profiles.js'
import { CrumbState, TickedCrumbs, TrailProgress, type TrailAction } from './progress.js'
import { MyRatingResponse, type RatingBody } from './ratings.js'
import { FinishedTrailList } from './badges.js'
import { CommunityList, MyCommunity } from './communities.js'
import { NeighborhoodList, TrendingList, type TrendingQuery } from './explore.js'
import { TrailSaved, type SaveTrailBody } from './trail-writes.js'
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
    return send('GET', path, schema, allowNotFound)
  }

  async function send<T extends z.ZodType>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    schema: T,
    allowNotFound = false,
    payload?: unknown,
  ): Promise<z.infer<T> | null> {
    const headers: Record<string, string> = { accept: 'application/json' }
    const token = await options.getAccessToken?.()
    if (token) headers.authorization = `Bearer ${token}`
    if (payload !== undefined) headers['content-type'] = 'application/json'

    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    })
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

    /** A profile by id or username, or null if there's no such person. */
    getProfile(handle: string) {
      return get(`/v1/profiles/${encodeURIComponent(handle)}`, PublicProfile, true)
    },

    /** Rating, made count and (for your own profile) finished count. */
    getProfileStats(profileId: string) {
      return get(`/v1/profiles/${encodeURIComponent(profileId)}/stats`, ProfileStats)
    },

    /** Trails a person made that the caller can see, newest first. */
    async getMadeTrails(profileId: string) {
      return (await get(`/v1/profiles/${encodeURIComponent(profileId)}/made-trails`, ProfileTrailList)).trails
    },

    /** The caller's own trails with a progress status (requires sign-in). */
    async getMyTrails(status: MyTrailsQuery['status']) {
      return (await get(`/v1/me/trails?status=${encodeURIComponent(status)}`, ProfileTrailList)).trails
    },

    /** Save a trail (or "save for later" mid-trail); returns the caller's new status. Requires sign-in. */
    async saveTrail(trailId: string) {
      return (await send('PUT', `/v1/me/saved-trails/${encodeURIComponent(trailId)}`, TrailProgress))!
    },

    /** Remove a saved trail (aborted if it was started, else deleted); returns the new status. Requires sign-in. */
    async unsaveTrail(trailId: string) {
      return (await send('DELETE', `/v1/me/saved-trails/${encodeURIComponent(trailId)}`, TrailProgress))!
    },

    /** Create a trail (draft or published) through save_trail(); returns its id. Requires sign-in. */
    async createTrail(body: SaveTrailBody) {
      return (await send('POST', '/v1/trails', TrailSaved, false, body))!
    },

    /** Replace one of your trails (stops included) through save_trail(); returns its id. Requires sign-in. */
    async updateTrail(id: string, body: SaveTrailBody) {
      return (await send('PUT', `/v1/trails/${encodeURIComponent(id)}`, TrailSaved, false, body))!
    },

    /** The caller's status on a trail (null = none). Requires sign-in. */
    getMyProgress(trailId: string) {
      return send('GET', `/v1/me/trails/${encodeURIComponent(trailId)}/progress`, TrailProgress) as Promise<TrailProgress>
    },

    /** Start, finish or abort a trail; returns the new status. Requires sign-in. */
    async trailAction(trailId: string, action: TrailAction) {
      return (await send('POST', `/v1/me/trails/${encodeURIComponent(trailId)}/${action}`, TrailProgress))!
    },

    /** Ids of the crumbs the caller has ticked on a trail. Requires sign-in. */
    async getTickedCrumbs(trailId: string) {
      return (await send('GET', `/v1/me/trails/${encodeURIComponent(trailId)}/crumbs`, TickedCrumbs))!.crumbIds
    },

    /** Tick (done = true) or untick a crumb during an active trail. Requires sign-in. */
    async setCrumb(crumbId: string, done: boolean) {
      return (await send(done ? 'PUT' : 'DELETE', `/v1/me/crumbs/${encodeURIComponent(crumbId)}`, CrumbState))!
    },

    /** The caller's rating of a trail, or null if they haven't rated it. Requires sign-in. */
    async getMyRating(trailId: string) {
      return (await send('GET', `/v1/me/trails/${encodeURIComponent(trailId)}/rating`, MyRatingResponse))!.rating
    },

    /** Rate a finished trail, or edit your rating; returns the stored rating. Requires sign-in. */
    async rateTrail(trailId: string, body: RatingBody) {
      return (await send('PUT', `/v1/me/trails/${encodeURIComponent(trailId)}/rating`, MyRatingResponse, false, body))!.rating
    },

    /** Delete your rating of a trail (nothing happens if there isn't one). Requires sign-in. */
    async deleteMyRating(trailId: string) {
      await send('DELETE', `/v1/me/trails/${encodeURIComponent(trailId)}/rating`, MyRatingResponse)
    },

    /** Trails with the most recent activity, busiest first (totals only). Requires sign-in. */
    async getTrending(query: TrendingQuery = {}) {
      const search = new URLSearchParams()
      if (query.days !== undefined) search.set('days', String(query.days))
      if (query.limit !== undefined) search.set('limit', String(query.limit))
      return (await get(`/v1/trending${search.size > 0 ? `?${search}` : ''}`, TrendingList)).trails
    },

    /** Neighborhoods with published trails the caller can see, A to Z. */
    async getNeighborhoods() {
      return (await get('/v1/neighborhoods', NeighborhoodList)).neighborhoods
    },

    /** Every community, by name. */
    async getCommunities() {
      return (await get('/v1/communities', CommunityList)).communities
    },

    /** Join a community, or leave by passing null; returns the caller's community. Requires sign-in. */
    async setMyCommunity(communityId: string | null) {
      return (await send('PUT', '/v1/me/community', MyCommunity, false, { communityId }))!
    },

    /** The caller's finished trails with line and neighborhood, for badges. Requires sign-in. */
    async getFinishedTrails() {
      return (await get('/v1/me/finished-trails', FinishedTrailList)).trails
    },

    /** The caller's Saved page: saved and in-progress trails (requires sign-in). */
    async getSavedTrails() {
      return (await get('/v1/me/saved-trails', SavedTrailList)).trails
    },
  }
}
