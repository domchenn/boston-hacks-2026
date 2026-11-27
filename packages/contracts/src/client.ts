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
  MyProfileFields,
  ProfileTrailList,
  PublicProfile,
  SavedTrailList,
  type MyProfileBody,
  type MyTrailsQuery,
} from './profiles.js'
import { CrumbState, TickedCrumbs, TrailProgress, type TrailAction } from './progress.js'
import { PhotoAdded, PhotoDeleted, TrailPhotoList, type AddPhotoQuery } from './photos.js'
import { MyRatingResponse, type RatingBody } from './ratings.js'
import { AdminStatus, OpenReportList, ReportResolved, ReportSent, type ReportBody } from './reports.js'
import { FinishedTrailList } from './badges.js'
import {
  AlsoSavedList,
  CloseFriendState,
  FollowCounts,
  FollowState,
  FriendsActivity,
  PersonIdList,
  PersonList,
  Privacy,
  Relationship,
  TrailCardList,
} from './friends.js'
import { CommunityList, MyCommunity } from './communities.js'
import { NeighborhoodList, TrendingList, type TrendingQuery } from './explore.js'
import { StopLibrary, TrailDeleted, TrailSaved, TrailUnpublished, type SaveTrailBody } from './trail-writes.js'
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
    /** A raw body (e.g. an image) sent as-is with its own content type, instead of JSON. */
    raw?: { body: Blob; contentType: string },
  ): Promise<z.infer<T> | null> {
    const headers: Record<string, string> = { accept: 'application/json' }
    const token = await options.getAccessToken?.()
    if (token) headers.authorization = `Bearer ${token}`
    if (raw) headers['content-type'] = raw.contentType
    else if (payload !== undefined) headers['content-type'] = 'application/json'

    const requestBody = raw ? raw.body : payload !== undefined ? JSON.stringify(payload) : undefined
    const response = await doFetch(`${baseUrl}${path}`, { method, headers, ...(requestBody !== undefined ? { body: requestBody } : {}) })
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

    /** How many people follow this person, and how many they follow. */
    getFollowCounts(userId: string) {
      return get(`/v1/profiles/${encodeURIComponent(userId)}/follow-counts`, FollowCounts)
    },

    /** Who follows this person ('followers') or whom they follow ('following'), newest first. */
    async getFollowList(userId: string, kind: 'followers' | 'following') {
      return (await get(`/v1/profiles/${encodeURIComponent(userId)}/${kind}`, PersonList)).people
    },

    /** Ids of everyone the caller follows. Requires sign-in. */
    async getFollowingIds() {
      return (await get('/v1/me/following-ids', PersonIdList)).ids
    },

    /** Follow (true) or unfollow (false) someone; repeating either is fine. Requires sign-in. */
    async setFollowing(userId: string, following: boolean) {
      return (await send(following ? 'PUT' : 'DELETE', `/v1/me/following/${encodeURIComponent(userId)}`, FollowState))!
    },

    /** Whether the caller follows this person and whether they follow back. Requires sign-in. */
    getRelationship(userId: string) {
      return get(`/v1/me/relationships/${encodeURIComponent(userId)}`, Relationship)
    },

    /** The caller's friends (mutual follows), A to Z. Requires sign-in. */
    async getFriends() {
      return (await get('/v1/me/friends', PersonList)).people
    },

    /** Ids on the caller's close friends list. Requires sign-in. */
    async getCloseFriendIds() {
      return (await get('/v1/me/close-friends', PersonIdList)).ids
    },

    /** Add (true) or remove (false) a friend from the close friends list. Requires sign-in. */
    async setCloseFriend(userId: string, on: boolean) {
      return (await send(on ? 'PUT' : 'DELETE', `/v1/me/close-friends/${encodeURIComponent(userId)}`, CloseFriendState))!
    },

    /** Make the caller's account private (trails visible to friends only) or public. Requires sign-in. */
    async setPrivateAccount(isPrivate: boolean) {
      return (await send('PUT', '/v1/me/privacy', Privacy, false, { isPrivate }))!
    },

    /** Cards for these trails (at most 100); trails the caller can't see are left out. */
    async getTrailCards(ids: string[]) {
      return (await get(`/v1/trail-cards?ids=${ids.map(encodeURIComponent).join(',')}`, TrailCardList)).trails
    },

    /** What the people the caller follows made or finished, newest first. Requires sign-in. */
    getFriendsActivity(limit?: number) {
      return get(`/v1/me/friends-activity${limit === undefined ? '' : `?limit=${limit}`}`, FriendsActivity)
    },

    /** Friends who saved the same trails as the caller, newest first. Requires sign-in. */
    async getFriendsAlsoSaved() {
      return (await get('/v1/me/friends-also-saved', AlsoSavedList)).saves
    },

    /** People whose @username or name contains `q` (not the caller). Requires sign-in. */
    async searchPeople(q: string, limit?: number) {
      const query = new URLSearchParams({ q })
      if (limit !== undefined) query.set('limit', String(limit))
      return (await get(`/v1/people?${query}`, PersonList)).people
    },

    /** People the caller might follow. Requires sign-in. */
    async getSuggestedPeople(limit?: number) {
      return (await get(`/v1/me/suggested-people${limit === undefined ? '' : `?limit=${limit}`}`, PersonList)).people
    },

    /** Each stop's place-library link and neighborhood (Edit and Remix). */
    async getStopLibrary(trailId: string) {
      return (await get(`/v1/trails/${encodeURIComponent(trailId)}/stop-library`, StopLibrary)).stops
    },

    /** Move one of your trails back to draft. Requires sign-in. */
    async unpublishTrail(trailId: string) {
      return (await send('POST', `/v1/trails/${encodeURIComponent(trailId)}/unpublish`, TrailUnpublished))!
    },

    /** Delete one of your trails for good. Requires sign-in. */
    async deleteTrail(trailId: string) {
      return (await send('DELETE', `/v1/trails/${encodeURIComponent(trailId)}`, TrailDeleted))!
    },

    /** The caller's editable profile fields. Requires sign-in. */
    getMyProfile() {
      return get('/v1/me/profile', MyProfileFields)
    },

    /** Save the caller's username and display name. Requires sign-in. */
    async updateMyProfile(body: MyProfileBody) {
      return (await send('PUT', '/v1/me/profile', MyProfileFields, false, body))!
    },

    /** A trail's public photos, newest first. */
    async getTrailPhotos(trailId: string) {
      return (await get(`/v1/trails/${encodeURIComponent(trailId)}/photos`, TrailPhotoList)).photos
    },

    /**
     * Add a photo to a trail you've saved, started or finished (optionally at one of its
     * stops). The image is sent as the body; the API stores a clean JPEG. Requires sign-in.
     */
    async addTrailPhoto(trailId: string, image: Blob, query: AddPhotoQuery = {}) {
      const search = new URLSearchParams()
      if (query.caption) search.set('caption', query.caption)
      if (query.stopId) search.set('stopId', query.stopId)
      const path = `/v1/trails/${encodeURIComponent(trailId)}/photos${search.size > 0 ? `?${search}` : ''}`
      return (await send('POST', path, PhotoAdded, false, undefined, { body: image, contentType: image.type || 'image/jpeg' }))!.photo
    },

    /** Delete one of your own photos. Requires sign-in. */
    async deletePhoto(photoId: string) {
      return (await send('DELETE', `/v1/photos/${encodeURIComponent(photoId)}`, PhotoDeleted))!
    },

    /** Report a trail, review or photo (repeating is fine). Requires sign-in. */
    async report(body: ReportBody) {
      return (await send('POST', '/v1/reports', ReportSent, false, body))!
    },

    /** Whether the caller is a team moderator. Requires sign-in. */
    async getAdminStatus() {
      return (await get('/v1/me/admin', AdminStatus)).isAdmin
    },

    /** Open reports with a preview of each item (moderators only). */
    async getOpenReports() {
      return (await get('/v1/admin/reports', OpenReportList)).reports
    },

    /** Hide the reported item or dismiss the report; closes every open report on that item (moderators only). */
    async resolveReport(reportId: string, action: 'hide' | 'dismiss') {
      return (await send('POST', `/v1/admin/reports/${encodeURIComponent(reportId)}/resolve`, ReportResolved, false, { action }))!
    },

    /** The caller's Saved page: saved and in-progress trails (requires sign-in). */
    async getSavedTrails() {
      return (await get('/v1/me/saved-trails', SavedTrailList)).trails
    },
  }
}
