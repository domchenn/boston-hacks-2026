/**
 * Reports and moderation contract (M16b). Anyone signed in reports a trail, a review
 * or a photo (POST /v1/reports; one report per person per item, repeating is fine).
 * Team moderators (profiles.is_admin) read open reports and resolve them: "hide"
 * archives the trail or deletes the review / photo (the photo's file too), "dismiss"
 * just closes it. Same data as the web's features/reports/api.ts.
 */
import { z } from 'zod'

const Uuid = z.uuid()

export const ReportTarget = z.enum(['trail', 'review', 'photo'])
export type ReportTarget = z.infer<typeof ReportTarget>

export const ReportReason = z.enum(['spam', 'inappropriate', 'unsafe', 'wrong_info', 'other'])
export type ReportReason = z.infer<typeof ReportReason>

/** POST /v1/reports body. A blank note is stored as none. */
export const ReportBody = z
  .object({ targetType: ReportTarget, targetId: Uuid, reason: ReportReason, note: z.string().max(1000).optional() })
  .strict()
export type ReportBody = z.infer<typeof ReportBody>

export const ReportSent = z.object({ reported: z.literal(true) })
export type ReportSent = z.infer<typeof ReportSent>

/** GET /v1/me/admin: whether the caller is a team moderator. */
export const AdminStatus = z.object({ isAdmin: z.boolean() })
export type AdminStatus = z.infer<typeof AdminStatus>

export const OpenReport = z.object({
  id: Uuid,
  targetType: ReportTarget,
  targetId: Uuid,
  reason: ReportReason,
  note: z.string().nullable(),
  createdAt: z.string(),
  /** The reporter's @username, if they have one. */
  reporter: z.string().nullable(),
  /** What was reported, for context: trail title, review text, or photo URL. Null when it's already gone. */
  preview: z
    .object({
      title: z.string().optional(),
      text: z.string().nullable().optional(),
      imageUrl: z.string().optional(),
      trailId: Uuid.optional(),
    })
    .nullable(),
})
export type OpenReport = z.infer<typeof OpenReport>

/** GET /v1/admin/reports: open reports, newest first (moderators only). */
export const OpenReportList = z.object({ reports: z.array(OpenReport) })
export type OpenReportList = z.infer<typeof OpenReportList>

export const ReportParams = z.object({ reportId: Uuid })
export type ReportParams = z.infer<typeof ReportParams>

/** POST /v1/admin/reports/:reportId/resolve body. */
export const ResolveReportBody = z.object({ action: z.enum(['hide', 'dismiss']) }).strict()
export type ResolveReportBody = z.infer<typeof ResolveReportBody>

/** Every open report on the same item gets this status. */
export const ReportResolved = z.object({ id: Uuid, status: z.enum(['hidden', 'dismissed']) })
export type ReportResolved = z.infer<typeof ReportResolved>

/** POST /v1/admin/photos/move-older: older public photos moved into private storage (moderators only). */
export const OlderPhotosMoved = z.object({
  moved: z.number().int().min(0),
  /** Photos that couldn't be moved, and why. Running it again retries them. */
  skipped: z.array(z.object({ photoId: Uuid, reason: z.string() })),
})
export type OlderPhotosMoved = z.infer<typeof OlderPhotosMoved>
