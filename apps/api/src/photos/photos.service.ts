/**
 * Trail photos (M16a), ported from the web's lib/api/photos.ts and run as the caller,
 * so the existing rules still decide everything:
 * - reading: RLS shows a trail's photos wherever the trail is visible;
 * - adding: the image is cleaned first (image-cleaner: a JPEG with no GPS or other
 *   metadata), stored in the `trail-photos` bucket under the caller's own folder
 *   (storage policy), then recorded in quest_photos (RLS: only on a trail you saved,
 *   started or finished; the stop must be on that trail). If recording fails, the
 *   stored file is removed again;
 * - deleting: only your own photo (RLS), then its file.
 * The photo's URL is always built here, never taken from the client.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TrailCreator, TrailPhoto } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'
import { cleanImage } from './image-cleaner.js'

export const PHOTO_BUCKET = 'trail-photos'
const BUCKET = PHOTO_BUCKET
const COLUMNS = 'id, photo_url, caption, created_at, stop_id, uploader:profiles!quest_photos_user_id_fkey(id, username, display_name, avatar_url)'
/** Progress statuses that may add photos (the quest_photos insert policy). */
const CAN_ADD = new Set(['saved', 'in_progress', 'completed'])
const NOT_STARTED = 'Start or save this trail before adding photos.'

type Row = { id: string; photo_url: string; caption: string | null; created_at: string; stop_id: string | null; uploader: TrailCreator | null }

const toPhoto = (row: Row): TrailPhoto => ({
  id: row.id,
  url: row.photo_url,
  caption: row.caption,
  createdAt: row.created_at,
  stopId: row.stop_id,
  uploader: row.uploader,
})

/** The storage path inside the photo bucket for one of our public URLs, else null. */
export function photoStoragePath(url: string): string | null {
  const marker = `/object/public/${PHOTO_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

function fail(error: { code?: string; message?: string }): never {
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name)

  constructor(private readonly clients: SupabaseClients) {}

  /** A trail's photos the caller can see, newest first. */
  async list(trailId: string, user: AuthUser | null): Promise<TrailPhoto[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('quest_photos')
      .select(COLUMNS)
      .eq('sidequest_id', trailId)
      .order('created_at', { ascending: false })
      .returns<Row[]>()
    if (error) fail(error)
    return data.map(toPhoto)
  }

  /** Cleans, stores and records a photo; returns it. */
  async add(trailId: string, image: Buffer, options: { caption?: string; stopId?: string }, user: AuthUser): Promise<TrailPhoto> {
    const db = this.clients.forUser(user)
    // Refuse before doing any work when the database would refuse the row anyway.
    const { data: progress, error: progressError } = await db
      .from('user_sidequests')
      .select('status')
      .eq('user_id', user.id)
      .eq('sidequest_id', trailId)
      .returns<{ status: string }[]>()
      .maybeSingle()
    if (progressError) fail(progressError)
    if (!progress || !CAN_ADD.has(progress.status)) throw new ForbiddenException(NOT_STARTED)

    const clean = await cleanImage(image)
    const path = `${user.id}/trails/${trailId}/${Date.now()}-${randomBytes(4).toString('hex')}.jpg`
    const stored = await db.storage.from(BUCKET).upload(path, clean, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
    if (stored.error) {
      this.logger.warn(`photo upload refused: ${stored.error.message}`)
      throw new Error('storage upload failed')
    }
    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    const { data, error } = await db
      .from('quest_photos')
      .insert({ user_id: user.id, sidequest_id: trailId, photo_url: url, caption: options.caption?.trim() || null, stop_id: options.stopId ?? null })
      .select(COLUMNS)
      .returns<Row[]>()
      .single()
    if (error) {
      await this.removeFile(db, path)
      if (error.code === '42501') throw new ForbiddenException(NOT_STARTED)
      if (error.code === '23514') throw new UnprocessableEntityException('That stop isn’t on this trail.')
      if (error.code === '23503') throw new NotFoundException('This trail isn’t available anymore.')
      fail(error)
    }
    return toPhoto(data)
  }

  /** Deletes one of your own photos (the row, then its file). */
  async remove(photoId: string, user: AuthUser): Promise<{ id: string; deleted: true }> {
    const db = this.clients.forUser(user)
    const { data, error } = await db.from('quest_photos').delete().eq('id', photoId).select('photo_url').returns<{ photo_url: string }[]>()
    if (error) fail(error)
    if (data.length === 0) throw new NotFoundException('You can only delete your own photos.')
    const path = photoStoragePath(data[0]!.photo_url)
    if (path) await this.removeFile(db, path)
    return { id: photoId, deleted: true }
  }

  /** Best effort: a leftover file is harmless, so a failed removal is only logged. */
  private async removeFile(db: SupabaseClient, path: string) {
    const { error } = await db.storage.from(BUCKET).remove([path])
    if (error) this.logger.warn(`couldn't remove photo file: ${error.message}`)
  }
}
