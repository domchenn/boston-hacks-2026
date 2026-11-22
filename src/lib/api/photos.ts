/**
 * Trail photos: a proof photo on a ticked crumb (checklist_completions.photo_url)
 * and public photos from an outing (quest_photos), stored in the Supabase
 * Storage bucket `trail-photos` under a folder named after the user's id
 * (the bucket's policies only allow that folder; see the add_trail_photos_storage
 * migration).
 *
 * Images are shrunk in the browser before upload (longest side 1600 px, JPEG),
 * so phone photos stay small and fit the 5 MB limit.
 *
 * Used by: Active trail (camera on crumbs, Add photos), Trail detail and the
 * Finished / Rate screen (photo grid).
 */

import { supabase } from '@/lib/supabase'
import type { TrailCreator } from '@/lib/api/trails'

export type TrailPhoto = {
  id: string
  url: string
  caption: string | null
  createdAt: string
  uploader: TrailCreator | null
}

const BUCKET = 'trail-photos'
const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Log in to add photos.')
  return id
}

/** Shrinks an image to at most MAX_SIDE px on its longest side and re-encodes it as JPEG. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Formats the browser can't decode (e.g. HEIC on some browsers): upload as-is.
    return file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.type === 'image/jpeg' && file.size < 1_500_000) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t process that photo.'))), 'image/jpeg', JPEG_QUALITY),
  )
}

/** Uploads into `<user id>/<folder>/` and returns { path, url }. */
async function upload(file: File, folder: string) {
  const userId = await currentUserId()
  const blob = await shrinkImage(file)
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg')
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || file.type,
    cacheControl: '31536000',
  })
  if (error) throw new Error(friendlyStorageError(error.message))
  return { path, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }
}

function friendlyStorageError(message: string) {
  if (/size|too large|exceeded/i.test(message)) return 'That photo is too big (max 5 MB).'
  if (/mime|type/i.test(message)) return 'Use a JPEG, PNG, WebP or HEIC photo.'
  if (/security|policy|unauthor/i.test(message)) return 'You can only add photos while logged in.'
  return 'Couldn’t upload that photo. Please try again.'
}

/** The storage path of one of our public URLs (…/object/public/trail-photos/<path>). */
function pathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

/**
 * Attach a proof photo to a crumb you've already ticked during an active
 * trail. Returns the photo URL. (Tick the crumb first; the camera button only
 * shows on ticked crumbs.)
 */
export async function uploadCrumbPhoto(crumbId: string, file: File): Promise<string> {
  const userId = await currentUserId()
  const { path, url } = await upload(file, `crumbs/${crumbId}`)
  const { data, error } = await supabase
    .from('checklist_completions')
    .update({ photo_url: url })
    .eq('user_id', userId)
    .eq('checklist_item_id', crumbId)
    .select('checklist_item_id')
  if (error || !data?.length) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(error ? 'Couldn’t save that photo. Please try again.' : 'Tick the crumb before adding a photo.')
  }
  return url
}

/** Add a public photo to a trail you've started, saved or finished. */
export async function addTrailPhoto(trailId: string, file: File, caption?: string): Promise<TrailPhoto> {
  const userId = await currentUserId()
  const { path, url } = await upload(file, `trails/${trailId}`)
  const { data, error } = await supabase
    .from('quest_photos')
    .insert({ user_id: userId, sidequest_id: trailId, photo_url: url, caption: caption?.trim() || null })
    .select('id, photo_url, caption, created_at, uploader:profiles!quest_photos_user_id_fkey(id, username, display_name, avatar_url)')
    .single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(
      error?.code === '42501' ? 'Start or save this trail before adding photos.' : 'Couldn’t save that photo. Please try again.',
    )
  }
  return { id: data.id, url: data.photo_url, caption: data.caption, createdAt: data.created_at, uploader: data.uploader }
}

/** Public photos on a trail, newest first. */
export async function getTrailPhotos(trailId: string): Promise<TrailPhoto[]> {
  const { data, error } = await supabase
    .from('quest_photos')
    .select('id, photo_url, caption, created_at, uploader:profiles!quest_photos_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('sidequest_id', trailId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    url: p.photo_url,
    caption: p.caption,
    createdAt: p.created_at,
    uploader: p.uploader,
  }))
}

/** Delete one of your own trail photos (the row, then the file). */
export async function deletePhoto(photoId: string): Promise<void> {
  const { data, error } = await supabase.from('quest_photos').delete().eq('id', photoId).select('photo_url')
  if (error) throw new Error('Couldn’t delete that photo. Please try again.')
  if (!data?.length) throw new Error('You can only delete your own photos.')
  const path = pathFromUrl(data[0].photo_url)
  if (path) await supabase.storage.from(BUCKET).remove([path])
}
