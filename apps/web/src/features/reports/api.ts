/**
 * Reporting content and the admin side of it (task D8).
 * - reportContent(): any logged-in user reports a trail, review or photo
 *   (one report per person per item; the database enforces it).
 * - isCurrentUserAdmin(), listOpenReports(), resolveReport(): for team
 *   moderators (profiles.is_admin). "Hide" archives the trail or deletes the
 *   review / photo; RLS only allows this for admins.
 */

import { supabase } from '@/lib/supabase'

export type ReportTarget = 'trail' | 'review' | 'photo'
export type ReportReason = 'spam' | 'inappropriate' | 'unsafe' | 'wrong_info' | 'other'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: 'Offensive or inappropriate' },
  { value: 'unsafe', label: 'Unsafe or dangerous' },
  { value: 'wrong_info', label: 'Wrong or misleading info (closed place, bad address…)' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'other', label: 'Something else' },
]

export type ReportResult = { ok: true } | { ok: false; message: string }

export async function reportContent(
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReason,
  note: string,
): Promise<ReportResult> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return { ok: false, message: 'Log in to report something.' }
  const { error } = await supabase.from('reports').insert({
    reporter_id: userId,
    target_type: targetType,
    target_id: targetId,
    reason,
    note: note.trim() || null,
  })
  if (!error) return { ok: true }
  if (error.code === '23505') return { ok: true } // already reported: treat as done
  return { ok: false, message: 'Couldn’t send the report. Please try again.' }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return false
  const { data: row } = await supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  return Boolean(row?.is_admin)
}

export type OpenReport = {
  id: string
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  note: string | null
  createdAt: string
  reporter: string | null
  /** What was reported, for context: trail title, review text, or photo URL. */
  preview: { title?: string; text?: string | null; imageUrl?: string; trailId?: string } | null
}

/** Open reports, newest first, with a preview of each reported item. */
export async function listOpenReports(): Promise<OpenReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, note, created_at, reporter:profiles!reports_reporter_id_fkey(username)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  const ids = (type: string) => rows.filter((r) => r.target_type === type).map((r) => r.target_id)

  const [trails, reviews, photos] = await Promise.all([
    ids('trail').length ? supabase.from('sidequests').select('id, title').in('id', ids('trail')) : null,
    ids('review').length
      ? supabase.from('sidequest_ratings').select('id, review_text, sidequest_id').in('id', ids('review'))
      : null,
    ids('photo').length ? supabase.from('quest_photos').select('id, photo_url, sidequest_id').in('id', ids('photo')) : null,
  ])
  const trailById = new Map((trails?.data ?? []).map((t) => [t.id, t]))
  const reviewById = new Map((reviews?.data ?? []).map((r) => [r.id, r]))
  const photoById = new Map((photos?.data ?? []).map((p) => [p.id, p]))

  return rows.map((r) => {
    let preview: OpenReport['preview'] = null
    if (r.target_type === 'trail' && trailById.has(r.target_id)) {
      const t = trailById.get(r.target_id)!
      preview = { title: t.title, trailId: t.id }
    } else if (r.target_type === 'review' && reviewById.has(r.target_id)) {
      const v = reviewById.get(r.target_id)!
      preview = { text: v.review_text, trailId: v.sidequest_id }
    } else if (r.target_type === 'photo' && photoById.has(r.target_id)) {
      const p = photoById.get(r.target_id)!
      preview = { imageUrl: p.photo_url, trailId: p.sidequest_id }
    }
    return {
      id: r.id,
      targetType: r.target_type as ReportTarget,
      targetId: r.target_id,
      reason: r.reason as ReportReason,
      note: r.note,
      createdAt: r.created_at,
      reporter: r.reporter?.username ?? null,
      preview,
    }
  })
}

/**
 * "hide": archive the trail, or delete the review / photo record, then mark
 * every open report on that item resolved. "dismiss": just close the report.
 * (A deleted photo's file stays in storage; only its owner can delete files.)
 */
export async function resolveReport(report: OpenReport, action: 'hide' | 'dismiss'): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const adminId = data.session?.user.id ?? null
  if (action === 'hide') {
    const result =
      report.targetType === 'trail'
        ? await supabase.from('sidequests').update({ status: 'archived' }).eq('id', report.targetId)
        : report.targetType === 'review'
          ? await supabase.from('sidequest_ratings').delete().eq('id', report.targetId)
          : await supabase.from('quest_photos').delete().eq('id', report.targetId)
    if (result.error) throw new Error('Couldn’t hide that. Are you signed in as an admin?')
  }
  const { error } = await supabase
    .from('reports')
    .update({ status: action === 'hide' ? 'hidden' : 'dismissed', resolved_at: new Date().toISOString(), resolved_by: adminId })
    .eq('target_type', report.targetType)
    .eq('target_id', report.targetId)
    .eq('status', 'open')
  if (error) throw new Error('Couldn’t update the report.')
}
