/**
 * Friends contract (M15b): follows, follow lists, how two people are connected,
 * close friends and the private-account switch. M15c: friends' activity, "you both
 * saved this", trail cards by id, people search and suggestions. Friends are people who follow each
 * other. Same data as the web's features/friends/api.ts. Follows are public; your
 * close friends list is readable only by you; a private account's trails are only
 * visible to friends (all enforced by RLS).
 */
import { z } from 'zod'
import { TrailCreator, TrailRating } from './trails.js'
import { Category } from './values.js'

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

/** A trail card (the web's TrailCardData) for activity and "also saved" lists. */
export const TrailCard = z.object({
  id: Uuid,
  title: z.string(),
  category: Category.nullable(),
  customCategory: z.string().nullable(),
  neighborhood: z.string().nullable(),
  estimatedCost: z.number().nullable(),
  estimatedMinutes: z.number().int().nullable(),
  scheduledAt: z.string().nullable(),
  stopCount: z.number().int().min(0),
  firstStopName: z.string().nullable(),
  lastStopName: z.string().nullable(),
  rating: TrailRating,
  creator: z.object({ username: z.string().nullable() }).nullable(),
})
export type TrailCard = z.infer<typeof TrailCard>

/** GET /v1/trail-cards?ids=a,b,c: at most 100 ids. Trails hidden from the caller are left out. */
export const TrailCardsQuery = z
  .object({
    ids: z
      .string()
      .transform((v) => v.split(',').filter(Boolean))
      .pipe(z.array(Uuid).min(1).max(100)),
  })
  .strict()
export type TrailCardsQuery = z.infer<typeof TrailCardsQuery>

export const TrailCardList = z.object({ trails: z.array(TrailCard) })
export type TrailCardList = z.infer<typeof TrailCardList>

/** GET /v1/me/friends-activity?limit= (1–100, default 30). */
export const ActivityQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).strict()
export type ActivityQuery = z.infer<typeof ActivityQuery>

export const ActivityItem = z.object({
  person: TrailCreator,
  kind: z.enum(['made', 'finished']),
  trailId: Uuid,
  /** When they made or finished it. */
  at: z.string(),
})
export type ActivityItem = z.infer<typeof ActivityItem>

/** What the people you follow made or finished, newest first, with a card for every trail in `items`. */
export const FriendsActivity = z.object({ items: z.array(ActivityItem), trails: z.array(TrailCard) })
export type FriendsActivity = z.infer<typeof FriendsActivity>

/** GET /v1/me/friends-also-saved: friends who saved the same trails as you, newest first. */
export const AlsoSavedList = z.object({ saves: z.array(z.object({ trailId: Uuid, friend: TrailCreator })) })
export type AlsoSavedList = z.infer<typeof AlsoSavedList>

/** GET /v1/people?q=&limit= (people search; fewer than 2 usable characters finds nobody). */
export const PeopleSearchQuery = z
  .object({ q: z.string().max(100), limit: z.coerce.number().int().min(1).max(20).optional() })
  .strict()
export type PeopleSearchQuery = z.infer<typeof PeopleSearchQuery>

/** GET /v1/me/suggested-people?limit= (1–20, default 6). */
export const SuggestionsQuery = z.object({ limit: z.coerce.number().int().min(1).max(20).optional() }).strict()
export type SuggestionsQuery = z.infer<typeof SuggestionsQuery>
