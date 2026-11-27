/**
 * Trail photos (M16a; private storage since photo privacy step 2), run as the caller,
 * so the existing rules still decide everything:
 * - reading: RLS shows a trail's photos wherever the trail is visible, and each comes
 *   with a link: a signed link that expires after an hour for photos in the private
 *   `photos` bucket, the public link for older photos (photo-files);
 * - adding: the image is cleaned first (image-cleaner: a JPEG with no GPS or other
 *   metadata), stored in the private bucket as "<trail id>/<random>.jpg" (no user id;
 *   storage policy: only with the trail saved, started or finished), then recorded in
 *   quest_photos (same rule in RLS; the stop must be on that trail). If recording
 *   fails, the stored file is removed again;
 * - deleting: only your own photo (RLS), then its file.
 * Links are always made here, never taken from the client.
 */
import { ForbiddenException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { TrailCreator, TrailPhoto } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'
import { cleanImage } from './image-cleaner.js'
import { PRIVATE_BUCKET, photoLinks, removePhotoFiles, type PhotoFile } from './photo-files.js'

const COLUMNS =
  'id, photo_url, storage_path, caption, created_at, stop_id, uploader:profiles!quest_photos_user_id_fkey(id, username, display_name, avatar_url)'
/** Progress statuses that may add photos (the quest_photos insert policy). */
const CAN_ADD = new Set(['saved', 'in_progress', 'completed'])
const NOT_STARTED = 'Start or save this trail before adding photos.'

type Row = PhotoFile & { id: string; caption: string | null; created_at: string; stop_id: string | null; uploader: TrailCreator | null }

function fail(error: { code?: string; message?: string }): never {
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name)

  constructor(private readonly clients: SupabaseClients) {}

  /** A trail's photos the caller can see, newest first, each with a link. */
  async list(trailId: string, user: AuthUser | null): Promise<TrailPhoto[]> {
    const db = this.clients.forUser(user)
    const { data, error } = await db
      .from('quest_photos')
      .select(COLUMNS)
      .eq('sidequest_id', trailId)
      .order('created_at', { ascending: false })
      .returns<Row[]>()
    if (error) fail(error)
    const links = await photoLinks(db, data)
    return data.flatMap((row) => {
      const url = links.get(row)
      return url ? [this.toPhoto(row, url)] : []
    })
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
    const path = `${trailId}/${randomUUID()}.jpg`
    const stored = await db.storage.from(PRIVATE_BUCKET).upload(path, clean, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
    if (stored.error) {
      this.logger.warn(`photo upload refused: ${stored.error.message}`)
      throw new Error('storage upload failed')
    }

    const { data, error } = await db
      .from('quest_photos')
      .insert({ user_id: user.id, sidequest_id: trailId, storage_path: path, caption: options.caption?.trim() || null, stop_id: options.stopId ?? null })
      .select(COLUMNS)
      .returns<Row[]>()
      .single()
    if (error) {
      await this.removeFiles(db, [{ storage_path: path, photo_url: null }])
      if (error.code === '42501') throw new ForbiddenException(NOT_STARTED)
      if (error.code === '23514') throw new UnprocessableEntityException('That stop isn’t on this trail.')
      if (error.code === '23503') throw new NotFoundException('This trail isn’t available anymore.')
      fail(error)
    }
    const url = (await photoLinks(db, [data])).get(data)
    if (!url) throw new Error('could not sign the new photo')
    return this.toPhoto(data, url)
  }

  /** Deletes one of your own photos (the row, then its file). */
  async remove(photoId: string, user: AuthUser): Promise<{ id: string; deleted: true }> {
    const db = this.clients.forUser(user)
    const { data, error } = await db.from('quest_photos').delete().eq('id', photoId).select('photo_url, storage_path').returns<PhotoFile[]>()
    if (error) fail(error)
    if (data.length === 0) throw new NotFoundException('You can only delete your own photos.')
    await this.removeFiles(db, data)
    return { id: photoId, deleted: true }
  }

  private toPhoto(row: Row, url: string): TrailPhoto {
    return { id: row.id, url, caption: row.caption, createdAt: row.created_at, stopId: row.stop_id, uploader: row.uploader }
  }

  /** Best effort: the record is already gone, so a file that couldn't be removed is only logged. */
  private async removeFiles(db: Parameters<typeof removePhotoFiles>[0], files: PhotoFile[]) {
    for (const problem of await removePhotoFiles(db, files)) this.logger.warn(`couldn't remove a photo file: ${problem}`)
  }
}
