/**
 * Profile and personal-list read contract (M12): profile lookup, profile stats,
 * a profile's made trails, your Finished / Saved / Signed-up lists and the Saved
 * page. Shapes match the web's features/profile/api.ts and features/saved/api.ts.
 * Profile fields keep the web's snake_case (they come straight from `profiles`).
 */
import { z } from 'zod'
import { Category, SidequestStatus } from './values.js'

const Uuid = z.uuid()
const Timestamp = z.string().describe('ISO 8601 timestamp')

/** profiles.username: 3–30 lowercase letters, digits or underscores. */
export const Username = z.string().regex(/^[a-z0-9_]{3,30}$/)

export const ProfileCommunity = z.object({ name: z.string(), slug: z.string().nullable() })
export type ProfileCommunity = z.infer<typeof ProfileCommunity>

/** GET /v1/profiles/:handle */
export const PublicProfile = z.object({
  id: Uuid,
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  university: z.string().nullable(),
  bio: z.string().nullable(),
  is_private: z.boolean(),
  /** The community they joined (e.g. BU, BC), if any. */
  community: ProfileCommunity.nullable(),
})
export type PublicProfile = z.infer<typeof PublicProfile>

/** A profile is looked up by id or by username. */
export const ProfileHandleParams = z.object({ handle: z.union([Uuid, Username]) })
export type ProfileHandleParams = z.infer<typeof ProfileHandleParams>

export const ProfileIdParams = z.object({ id: Uuid })
export type ProfileIdParams = z.infer<typeof ProfileIdParams>

export const QuestgiverRating = z.object({ average: z.number().min(1).max(5), count: z.number().int().positive() })
export type QuestgiverRating = z.infer<typeof QuestgiverRating>

/** GET /v1/profiles/:id/stats */
export const ProfileStats = z.object({
  /** Average overall rating across their trails; null until someone rates one. */
  questgiverRating: QuestgiverRating.nullable(),
  /** Trails they made that the caller can see (their own include drafts), excluding archived. */
  madeCount: z.number().int().min(0),
  /** Trails they finished; only for your own profile (progress is private), otherwise null. */
  finishedCount: z.number().int().min(0).nullable(),
})
export type ProfileStats = z.infer<typeof ProfileStats>

/** A trail as listed on a profile tab. */
export const ProfileTrail = z.object({
  id: Uuid,
  title: z.string(),
  category: Category.nullable(),
  customCategory: z.string().nullable(),
  scheduledAt: Timestamp.nullable(),
  estimatedCost: z.number().min(0).nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  neighborhood: z.string().nullable(),
  /** sidequests.status: 'draft' only ever appears on your own Made tab. */
  trailStatus: SidequestStatus,
  completedAt: Timestamp.nullable(),
  /** Your overall rating (mean of the four scores), on Finished trails you rated. */
  myRating: z.number().min(1).max(5).nullable(),
})
export type ProfileTrail = z.infer<typeof ProfileTrail>

/** GET /v1/profiles/:id/made-trails and GET /v1/me/trails */
export const ProfileTrailList = z.object({ trails: z.array(ProfileTrail) })
export type ProfileTrailList = z.infer<typeof ProfileTrailList>

/** GET /v1/me/trails?status= — the caller's own progress tabs. */
export const MyTrailsQuery = z.object({ status: z.enum(['completed', 'saved', 'signed_up']) }).strict()
export type MyTrailsQuery = z.infer<typeof MyTrailsQuery>

/** A card on the Saved page: saved or in-progress trails (old signed_up rows count as saved). */
export const SavedTrail = z.object({
  id: Uuid,
  title: z.string(),
  category: Category.nullable(),
  customCategory: z.string().nullable(),
  neighborhood: z.string().nullable(),
  estimatedCost: z.number().min(0).nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  stopCount: z.number().int().min(0),
  firstStopName: z.string().nullable(),
  lastStopName: z.string().nullable(),
  rating: z.object({ average: z.number().min(1).max(5).nullable(), count: z.number().int().min(0) }),
  creator: z.object({ username: z.string().nullable() }).nullable(),
  status: z.enum(['saved', 'in_progress']),
  updatedAt: Timestamp,
})
export type SavedTrail = z.infer<typeof SavedTrail>

/** GET /v1/me/saved-trails */
export const SavedTrailList = z.object({ trails: z.array(SavedTrail) })
export type SavedTrailList = z.infer<typeof SavedTrailList>
