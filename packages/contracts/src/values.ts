/**
 * Allowed values for restricted text columns, matching the database CHECK
 * constraints (and apps/web/src/types/db-values.ts). Keep in sync with
 * supabase/migrations/ when a constraint changes.
 */
import { z } from 'zod'

/** sidequests.category ('other' = the creator's own, named in custom_category) */
export const Category = z.enum(['food_drink', 'outdoors', 'arts_culture', 'shopping', 'attractions', 'affordable', 'other'])
export type Category = z.infer<typeof Category>

/** sidequests.status */
export const SidequestStatus = z.enum(['draft', 'published', 'archived'])
export type SidequestStatus = z.infer<typeof SidequestStatus>

/** sidequests.visibility: who can see a published trail */
export const TrailVisibility = z.enum(['public', 'friends', 'close_friends'])
export type TrailVisibility = z.infer<typeof TrailVisibility>

/** sidequests.primary_line: the trail's main T line */
export const TransitLine = z.enum(['rl', 'gl', 'bl', 'ol', 'sl', 'cr'])
export type TransitLine = z.infer<typeof TransitLine>

/** sidequest_stops.travel_mode_to_stop */
export const TravelMode = z.enum(['walk', 'bike', 'bus', 'train'])
export type TravelMode = z.infer<typeof TravelMode>

/** checklist_items.item_type */
export const ChecklistItemType = z.enum(['see', 'do'])
export type ChecklistItemType = z.infer<typeof ChecklistItemType>

/** user_sidequests.status: a user's progress on one trail */
export const UserSidequestStatus = z.enum(['saved', 'signed_up', 'in_progress', 'completed', 'aborted'])
export type UserSidequestStatus = z.infer<typeof UserSidequestStatus>
