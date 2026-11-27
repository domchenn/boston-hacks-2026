/**
 * Reports and moderation (M16b), ported from the web's features/reports/api.ts and
 * run as the caller, so RLS still decides:
 * - anyone signed in reports a trail, review or photo as themselves (one report per
 *   person per item; repeating is fine);
 * - only team moderators (profiles.is_admin) read open reports and resolve them. The
 *   API checks that first (403), because RLS would otherwise show a non-admin their
 *   own reports instead of refusing;
 * - "hide" archives a trail, or deletes a review or a photo, and for a photo its file
 *   too (storage policy let_admins_remove_photo_files); then every open report on
 *   that item is closed. "dismiss" only closes them.
 */
import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OpenReport, ReportBody, ReportReason, ReportTarget } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { PHOTO_BUCKET, photoStoragePath } from '../photos/photos.service.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type DbError = { code?: string; message?: string }
type ReportRow = {
  id: string
  target_type: ReportTarget
  target_id: string
  reason: ReportReason
  note: string | null
  created_at: string
  status: string
  reporter: { username: string | null } | null
}

const TEAM_ONLY = 'Only the Breadcrumb team can do this.'

function fail(error: DbError): never {
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name)

  constructor(private readonly clients: SupabaseClients) {}

  async report(body: ReportBody, user: AuthUser): Promise<{ reported: true }> {
    const { error } = await this.clients.forUser(user).from('reports').insert({
      reporter_id: user.id,
      target_type: body.targetType,
      target_id: body.targetId,
      reason: body.reason,
      note: body.note?.trim() || null,
    })
    // 23505: already reported by this person, which counts as done.
    if (error && error.code !== '23505') fail(error)
    return { reported: true }
  }

  async isAdmin(user: AuthUser): Promise<boolean> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .returns<{ is_admin: boolean }[]>()
      .maybeSingle()
    if (error) fail(error)
    return Boolean(data?.is_admin)
  }

  /** Open reports, newest first, each with a preview of what was reported. */
  async openReports(user: AuthUser): Promise<OpenReport[]> {
    await this.requireAdmin(user)
    const db = this.clients.forUser(user)
    const { data, error } = await db
      .from('reports')
      .select('id, target_type, target_id, reason, note, created_at, status, reporter:profiles!reports_reporter_id_fkey(username)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .returns<ReportRow[]>()
    if (error) fail(error)
    const ids = (type: ReportTarget) => data.filter((r) => r.target_type === type).map((r) => r.target_id)
    const [trails, reviews, photos] = await Promise.all([
      ids('trail').length ? db.from('sidequests').select('id, title').in('id', ids('trail')).returns<{ id: string; title: string }[]>() : null,
      ids('review').length
        ? db.from('sidequest_ratings').select('id, review_text, sidequest_id').in('id', ids('review')).returns<{ id: string; review_text: string | null; sidequest_id: string }[]>()
        : null,
      ids('photo').length
        ? db.from('quest_photos').select('id, photo_url, sidequest_id').in('id', ids('photo')).returns<{ id: string; photo_url: string; sidequest_id: string }[]>()
        : null,
    ])
    const trailById = new Map((trails?.data ?? []).map((t) => [t.id, t]))
    const reviewById = new Map((reviews?.data ?? []).map((r) => [r.id, r]))
    const photoById = new Map((photos?.data ?? []).map((p) => [p.id, p]))
    return data.map((r) => {
      let preview: OpenReport['preview'] = null
      const trail = r.target_type === 'trail' ? trailById.get(r.target_id) : undefined
      const review = r.target_type === 'review' ? reviewById.get(r.target_id) : undefined
      const photo = r.target_type === 'photo' ? photoById.get(r.target_id) : undefined
      if (trail) preview = { title: trail.title, trailId: trail.id }
      else if (review) preview = { text: review.review_text, trailId: review.sidequest_id }
      else if (photo) preview = { imageUrl: photo.photo_url, trailId: photo.sidequest_id }
      return {
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        note: r.note,
        createdAt: r.created_at,
        reporter: r.reporter?.username ?? null,
        preview,
      }
    })
  }

  /** Hide the reported item (or not), then close every open report on it. */
  async resolve(reportId: string, action: 'hide' | 'dismiss', user: AuthUser): Promise<{ id: string; status: 'hidden' | 'dismissed' }> {
    await this.requireAdmin(user)
    const db = this.clients.forUser(user)
    const { data: report, error } = await db
      .from('reports')
      .select('target_type, target_id, status')
      .eq('id', reportId)
      .returns<{ target_type: ReportTarget; target_id: string; status: string }[]>()
      .maybeSingle()
    if (error) fail(error)
    if (!report) throw new NotFoundException('That report doesn’t exist.')
    if (report.status !== 'open') throw new ConflictException('This report was already handled.')

    if (action === 'hide') await this.hide(db, report.target_type, report.target_id)
    const status = action === 'hide' ? 'hidden' : 'dismissed'
    const closed = await db
      .from('reports')
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('target_type', report.target_type)
      .eq('target_id', report.target_id)
      .eq('status', 'open')
    if (closed.error) fail(closed.error)
    return { id: reportId, status }
  }

  private async hide(db: SupabaseClient, type: ReportTarget, id: string) {
    if (type === 'trail') {
      const { error } = await db.from('sidequests').update({ status: 'archived' }).eq('id', id)
      if (error) fail(error)
    } else if (type === 'review') {
      const { error } = await db.from('sidequest_ratings').delete().eq('id', id)
      if (error) fail(error)
    } else {
      const { data, error } = await db.from('quest_photos').delete().eq('id', id).select('photo_url').returns<{ photo_url: string }[]>()
      if (error) fail(error)
      const path = data[0] ? photoStoragePath(data[0].photo_url) : null
      if (path) {
        const removed = await db.storage.from(PHOTO_BUCKET).remove([path])
        if (removed.error) this.logger.warn(`couldn't remove a hidden photo's file: ${removed.error.message}`)
      }
    }
  }

  private async requireAdmin(user: AuthUser) {
    if (!(await this.isAdmin(user))) throw new ForbiddenException(TEAM_ONLY)
  }
}
