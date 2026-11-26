/**
 * Progress contract for the signed-in user: saving / unsaving (M12b), the caller's
 * status on a trail, starting / finishing / aborting it, and ticking crumbs (M14a).
 * Actions answer with the caller's resulting status (null = no row). The transition
 * rules match the web's lib/api/progress.ts exactly.
 */
import { z } from 'zod'
import { UserSidequestStatus } from './values.js'

/** PUT / DELETE /v1/me/saved-trails/:trailId path parameters. */
export const TrailProgressParams = z.object({ trailId: z.uuid() })
export type TrailProgressParams = z.infer<typeof TrailProgressParams>

/** The caller's status on one trail after an action; null when they have no row. */
export const TrailProgress = z.object({ status: UserSidequestStatus.nullable() })
export type TrailProgress = z.infer<typeof TrailProgress>

/** POST /v1/me/trails/:trailId/{start,finish,abort} */
export const TrailAction = z.enum(['start', 'finish', 'abort'])
export type TrailAction = z.infer<typeof TrailAction>

/** GET /v1/me/trails/:trailId/crumbs: ids of the crumbs the caller has ticked on that trail. */
export const TickedCrumbs = z.object({ crumbIds: z.array(z.uuid()) })
export type TickedCrumbs = z.infer<typeof TickedCrumbs>

/** PUT / DELETE /v1/me/crumbs/:crumbId path parameters. */
export const CrumbParams = z.object({ crumbId: z.uuid() })
export type CrumbParams = z.infer<typeof CrumbParams>

/** The crumb's state after ticking (PUT) or unticking (DELETE). */
export const CrumbState = z.object({ done: z.boolean() })
export type CrumbState = z.infer<typeof CrumbState>
