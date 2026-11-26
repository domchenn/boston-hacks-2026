/**
 * Friends contract (M15b): follows, follow lists, how two people are connected,
 * close friends and the private-account switch. Friends are people who follow each
 * other. Same data as the web's features/friends/api.ts. Follows are public; your
 * close friends list is readable only by you; a private account's trails are only
 * visible to friends (all enforced by RLS).
 */
import { z } from 'zod'
import { TrailCreator } from './trails.js'

const Uuid = z.uuid()

/** GET /v1/profiles/:id/follow-counts */
export const FollowCounts = z.object({ followers: z.number().int().min(0), following: z.number().int().min(0) })
export type FollowCounts = z.infer<typeof FollowCounts>

/** Follower / following lists (newest first, at most 500) and your friends (A to Z). */
export const PersonList = z.object({ people: z.array(TrailCreator) })
export type PersonList = z.infer<typeof PersonList>

/** Ids of people you follow, or of your close friends. */
export const PersonIdList = z.object({ ids: z.array(Uuid) })
export type PersonIdList = z.infer<typeof PersonIdList>

/** Path parameter for routes about one other person. */
export const PersonParams = z.object({ userId: Uuid })
export type PersonParams = z.infer<typeof PersonParams>

/** GET /v1/me/relationships/:userId: friends = both true. */
export const Relationship = z.object({ following: z.boolean(), followsYou: z.boolean() })
export type Relationship = z.infer<typeof Relationship>

/** PUT / DELETE /v1/me/following/:userId response. */
export const FollowState = z.object({ following: z.boolean() })
export type FollowState = z.infer<typeof FollowState>

/** PUT / DELETE /v1/me/close-friends/:userId response. */
export const CloseFriendState = z.object({ closeFriend: z.boolean() })
export type CloseFriendState = z.infer<typeof CloseFriendState>

/** PUT /v1/me/privacy body and response. */
export const Privacy = z.object({ isPrivate: z.boolean() }).strict()
export type Privacy = z.infer<typeof Privacy>
