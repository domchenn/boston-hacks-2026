/**
 * Creating and editing trails (M13) through the database function save_trail(),
 * called as the signed-in user. save_trail() does everything in one transaction:
 * the publish checklist, the community and visibility rules, remix checks, and
 * replacing the stops and crumbs. So the API adds no rules of its own; it maps
 * the function's errors to HTTP statuses and passes its friendly messages on:
 *
 *   23514 (a rule like "Add at least 2 stops before publishing") → 422
 *   22023 (a bad value)                                          → 400
 *   42501 (not yours, not your community, can't see the remix)   → 403
 *   23503 (a referenced place or community no longer exists)    → 422
 *
 * Also the editor's other calls, ported from the web's features/make/edit-trail.ts:
 * each stop's place-library link (sign-in optional, RLS decides), and unpublishing
 * or deleting a trail (RLS: its creator, or an admin). When nothing matched, the
 * trail isn't yours or is gone, which is a 404.
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { SaveTrailBody } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { removePhotoFiles, trailPhotoFiles } from '../photos/photo-files.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type DbError = { code?: string; message?: string }
const NOT_YOURS = 'This trail isn’t yours, or it no longer exists.'

function rethrow(error: DbError): never {
  const message = error.message ?? 'This trail couldn’t be saved.'
  switch (error.code) {
    case '23514':
      throw new UnprocessableEntityException(message)
    case '22023':
    case '22P02':
      throw new BadRequestException(message)
    case '42501':
      throw new ForbiddenException(message)
    case '23503':
      throw new UnprocessableEntityException('Something this trail points to no longer exists. Refresh and try again.')
    default:
      throw Object.assign(new Error(error.message ?? 'save_trail failed'), { code: error.code })
  }
}

@Injectable()
export class TrailWritesService {
  private readonly logger = new Logger(TrailWritesService.name)

  constructor(private readonly clients: SupabaseClients) {}

  /** Creates (id null) or replaces (id set) the caller's trail; returns its id. */
  async save(body: SaveTrailBody, id: string | null, user: AuthUser): Promise<{ id: string }> {
    const { data, error } = await this.clients
      .forUser(user)
      .rpc('save_trail', { p_trail: body, ...(id ? { p_trail_id: id } : {}) })
    if (error) rethrow(error)
    return { id: data as string }
  }

  /** Each stop's place-library link and that place's neighborhood. */
  async stopLibrary(trailId: string, user: AuthUser | null) {
    const { data, error } = await this.clients
      .forUser(user)
      .from('sidequest_stops')
      .select('id, experience_id, experiences(neighborhood)')
      .eq('sidequest_id', trailId)
      .returns<{ id: string; experience_id: string | null; experiences: { neighborhood: string | null } | null }[]>()
    if (error) throw error
    return data.map((row) => ({ stopId: row.id, experienceId: row.experience_id, neighborhood: row.experiences?.neighborhood ?? null }))
  }

  /** Back to draft: hidden from everyone but its creator. Stops and crumbs are untouched. */
  async unpublish(trailId: string, user: AuthUser): Promise<{ id: string; status: 'draft' }> {
    const { data, error } = await this.clients.forUser(user).from('sidequests').update({ status: 'draft' }).eq('id', trailId).select('id')
    if (error) throw error
    if (data.length === 0) throw new NotFoundException(NOT_YOURS)
    return { id: trailId, status: 'draft' }
  }

  /** Deletes the trail for good: its stops, crumbs, everyone's progress and ratings go with it. */
  /**
   * Deletes the trail and, first, every photo file on it, anyone's (storage policy: a
   * trail's creator can delete the files in its folder). Older public photos can only
   * be removed by their uploader, so other people's are left until they're moved.
   */
  async remove(trailId: string, user: AuthUser): Promise<{ id: string; deleted: true }> {
    const db = this.clients.forUser(user)
    const { data: trail, error: readError } = await db.from('sidequests').select('creator_id').eq('id', trailId).returns<{ creator_id: string }[]>().maybeSingle()
    if (readError) throw readError
    if (!trail || trail.creator_id !== user.id) throw new NotFoundException(NOT_YOURS)

    for (const problem of await removePhotoFiles(db, await trailPhotoFiles(db, trailId))) this.logger.warn(`couldn't remove a deleted trail's photo file: ${problem}`)

    const { data, error } = await db.from('sidequests').delete().eq('id', trailId).select('id')
    if (error) throw error
    if (data.length === 0) throw new NotFoundException(NOT_YOURS)
    return { id: trailId, deleted: true }
  }
}
