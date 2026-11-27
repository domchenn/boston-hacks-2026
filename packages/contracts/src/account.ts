/**
 * Account contract: DELETE /v1/me deletes the caller's account and everything linked
 * to it (trails with everything on them, progress, ratings, photos and their files,
 * follows). The body must say { confirm: true } so a stray request can't do it.
 * Reports the person filed are kept without their name.
 */
import { z } from 'zod'

export const DeleteAccountBody = z.object({ confirm: z.literal(true) }).strict()
export type DeleteAccountBody = z.infer<typeof DeleteAccountBody>

export const AccountDeleted = z.object({ deleted: z.literal(true) })
export type AccountDeleted = z.infer<typeof AccountDeleted>
