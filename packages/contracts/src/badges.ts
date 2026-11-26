/**
 * Badges contract (M15a): GET /v1/me/finished-trails (sign-in required), the caller's
 * finished trails with their T line and neighborhood, from which the web computes
 * badges (features/badges/computeBadges.ts). Progress is private, so this only
 * exists for yourself. A finished trail now hidden from you still counts, with
 * line and neighborhood null.
 */
import { z } from 'zod'
import { TransitLine } from './values.js'

export const FinishedTrail = z.object({
  completedAt: z.string(),
  line: TransitLine.nullable(),
  neighborhood: z.string().nullable(),
})
export type FinishedTrail = z.infer<typeof FinishedTrail>

export const FinishedTrailList = z.object({ trails: z.array(FinishedTrail) })
export type FinishedTrailList = z.infer<typeof FinishedTrailList>
