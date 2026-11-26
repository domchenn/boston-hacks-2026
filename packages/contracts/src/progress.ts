/**
 * Progress write contract (M12b): saving and unsaving a trail for the signed-in user.
 * Both answer with the caller's resulting status on that trail (null = no row).
 * The transition rules match the web's lib/api/progress.ts exactly.
 */
import { z } from 'zod'
import { UserSidequestStatus } from './values.js'

/** PUT / DELETE /v1/me/saved-trails/:trailId path parameters. */
export const TrailProgressParams = z.object({ trailId: z.uuid() })
export type TrailProgressParams = z.infer<typeof TrailProgressParams>

/** The caller's status on one trail after an action; null when they have no row. */
export const TrailProgress = z.object({ status: UserSidequestStatus.nullable() })
export type TrailProgress = z.infer<typeof TrailProgress>
