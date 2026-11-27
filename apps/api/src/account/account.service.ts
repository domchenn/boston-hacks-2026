/**
 * Self-serve account deletion (photo privacy step 3), run as the caller. Photo files
 * aren't database rows, so they go first, through Storage, while the account still
 * exists and its permissions still apply:
 * - every photo file on the caller's own trails, anyone's (a trail's creator may
 *   delete the files in its folder);
 * - the caller's own photo files on other people's trails;
 * - anything left in the caller's folder of the older public bucket.
 * If Storage refuses any of it, nothing else is deleted and the caller can retry.
 * Then public.delete_my_account() deletes the sign-in account, and the database
 * cascade removes everything else (reports they filed are kept without their name).
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import type { AuthUser } from '../auth/auth-user.js'
import { legacyFolderFiles, removePhotoFiles, trailPhotoFiles, type PhotoFile } from '../photos/photo-files.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

function fail(error: { code?: string; message?: string }): never {
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name)

  constructor(private readonly clients: SupabaseClients) {}

  async deleteAccount(user: AuthUser): Promise<{ deleted: true }> {
    const db = this.clients.forUser(user)
    const [trails, photos] = await Promise.all([
      db.from('sidequests').select('id').eq('creator_id', user.id).returns<{ id: string }[]>(),
      db.from('quest_photos').select('photo_url, storage_path').eq('user_id', user.id).returns<PhotoFile[]>(),
    ])
    if (trails.error) fail(trails.error)
    if (photos.error) fail(photos.error)

    const files: PhotoFile[] = [...photos.data, ...(await legacyFolderFiles(db, user.id))]
    for (const trail of trails.data) files.push(...(await trailPhotoFiles(db, trail.id)))
    const problems = await removePhotoFiles(db, files)
    if (problems.length > 0) {
      this.logger.warn(`account deletion stopped, photo files not removed: ${problems.join('; ')}`)
      throw new ServiceUnavailableException('We couldn’t remove all your photos, so your account is still here. Please try again.')
    }

    const { error } = await db.rpc('delete_my_account')
    if (error) fail(error)
    return { deleted: true }
  }
}
