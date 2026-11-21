/**
 * Trail actions for the logged-in user: save, join, start, finish, abort.
 * Each writes the user's row in user_sidequests (one row per user per trail,
 * status saved / signed_up / in_progress / completed / aborted).
 *
 * Owner: Gio. These are agreed signatures so other screens (e.g. Jason's trail
 * detail buttons) can call them now. Fill in the bodies; don't rename them.
 */

import type { UserSidequestStatus } from '@/types/db-values'

const notYet = (name: string) => () =>
  Promise.reject(new Error(`${name}() is not implemented yet (src/lib/api/progress.ts)`))

/** The user's status on a trail, or null if they have no row yet. */
export const getMyStatus: (trailId: string) => Promise<UserSidequestStatus | null> = notYet('getMyStatus')

/** Bookmark a trail (status 'saved'). */
export const saveTrail: (trailId: string) => Promise<void> = notYet('saveTrail')

/** Remove the bookmark (deletes the row if the trail wasn't started). */
export const unsaveTrail: (trailId: string) => Promise<void> = notYet('unsaveTrail')

/** Sign up for a scheduled trail (status 'signed_up'). Only works if scheduled_at is set. */
export const joinTrail: (trailId: string) => Promise<void> = notYet('joinTrail')

/** Start the trail (status 'in_progress'). Resumes if already started. */
export const startTrail: (trailId: string) => Promise<void> = notYet('startTrail')

/** Finish the trail (status 'completed'). Unlocks rating. */
export const finishTrail: (trailId: string) => Promise<void> = notYet('finishTrail')

/** Stop the attempt (status 'aborted'). Doesn't count as finished. */
export const abortTrail: (trailId: string) => Promise<void> = notYet('abortTrail')

/** Tick or untick a crumb (checklist_items row) during an active trail. */
export const toggleCrumb: (crumbId: string, done: boolean) => Promise<void> = notYet('toggleCrumb')
