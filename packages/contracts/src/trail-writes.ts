/**
 * Trail write contract (M13): the body of POST /v1/trails (create) and
 * PUT /v1/trails/:id (replace), and the response. The body is exactly the JSON the
 * database function save_trail() takes, which the web already builds (toSavePayload
 * in apps/web/src/features/make/draft.ts), so the web can send it unchanged.
 *
 * Types and sizes are checked here; the business rules (a name, a category and
 * 2–8 stops to publish, your own community, remixing only what you can see) stay in
 * save_trail(), whose friendly messages the API passes through. Absent
 * `community_id` / `visibility` keys mean "leave as is" when editing.
 */
import { z } from 'zod'
import { Category, TrailVisibility, TravelMode } from './values.js'

const Uuid = z.uuid()

export const SaveTrailStop = z
  .object({
    experience_id: Uuid.nullable().optional(),
    place_name: z.string().max(200),
    address: z.string().max(300).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    /** Ignored for the first stop. */
    travel_mode_to_stop: TravelMode.nullable().optional(),
    estimated_cost: z.number().min(0).nullable().optional(),
    /** One optional crumb (a small task) at this stop. */
    crumb: z.string().max(200).optional(),
  })
  .strict()
export type SaveTrailStop = z.infer<typeof SaveTrailStop>

export const SaveTrailBody = z
  .object({
    title: z.string().max(120),
    description: z.string().max(5000).nullable().optional(),
    category: Category.nullable().optional(),
    /** Your own category name when category is 'other'. */
    custom_category: z.string().max(60).nullable().optional(),
    scheduled_at: z.string().nullable().optional(),
    status: z.enum(['draft', 'published']),
    estimated_cost: z.number().min(0).nullable().optional(),
    estimated_duration_minutes: z.number().int().positive().max(10080).nullable().optional(),
    neighborhood: z.string().max(80).nullable().optional(),
    /** null = everyone; an id = only that community (yours); absent = leave as is. */
    community_id: Uuid.nullable().optional(),
    /** Absent = leave as is (new trails: public). */
    visibility: TrailVisibility.optional(),
    /** New trails only: the trail this one was copied from. */
    remixed_from: Uuid.nullable().optional(),
    /** In order. save_trail() allows at most 8 and replaces all stops on every save. */
    stops: z.array(SaveTrailStop).max(50),
  })
  .strict()
export type SaveTrailBody = z.infer<typeof SaveTrailBody>

/** POST /v1/trails and PUT /v1/trails/:id response. */
export const TrailSaved = z.object({ id: Uuid })
export type TrailSaved = z.infer<typeof TrailSaved>
