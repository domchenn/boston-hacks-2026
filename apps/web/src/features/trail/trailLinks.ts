/**
 * Small helpers shared by the trail pages: checking a /trails/:id id before
 * querying, and the login link that brings the user back afterwards.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True if `id` looks like a trail id (a UUID), so junk URLs show "not found" without a query. */
export const isTrailId = (id: string) => UUID.test(id)

/** /login?next=… so AuthPage sends the user back to `path` once they're in. */
export const loginPath = (path: string) => `/login?next=${encodeURIComponent(path)}`

/** Message the Rate page hands to Trail detail (router state) after posting or removing a rating. */
export type TrailNotice = { notice?: string }
