/**
 * Where photo files live and how they are served and removed, shared by the photos,
 * moderation and trail-deletion code. Everything runs with the caller's own client,
 * so Storage policies decide:
 * - new photos are in the private `photos` bucket at "<trail id>/<random>.jpg" and are
 *   served by signed links that expire after an hour (Storage signs only for people
 *   who can see the trail);
 * - older photos are in the public `trail-photos` bucket and keep their public link.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const PRIVATE_BUCKET = 'photos'
export const LEGACY_BUCKET = 'trail-photos'
/** How long a signed photo link works. */
export const SIGNED_LINK_SECONDS = 60 * 60

/** A photo's file: a path in the private bucket, or an older public link. */
export type PhotoFile = { storage_path: string | null; photo_url: string | null }

/** The path inside the legacy public bucket for one of its public links, else null. */
export function legacyPath(url: string): string | null {
  const marker = `/object/public/${LEGACY_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

/**
 * A link for each file the caller may see: signed for private files, the public link
 * for older ones. Files the caller can't see (or that are gone) get no entry.
 */
export async function photoLinks(db: SupabaseClient, files: PhotoFile[]): Promise<Map<PhotoFile, string>> {
  const links = new Map<PhotoFile, string>()
  const paths = [...new Set(files.flatMap((f) => (f.storage_path ? [f.storage_path] : [])))]
  const signed = new Map<string, string>()
  if (paths.length > 0) {
    const { data, error } = await db.storage.from(PRIVATE_BUCKET).createSignedUrls(paths, SIGNED_LINK_SECONDS)
    if (error) throw Object.assign(new Error(error.message), { code: 'storage' })
    for (const entry of data) if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl)
  }
  for (const file of files) {
    const link = file.storage_path ? signed.get(file.storage_path) : (file.photo_url ?? undefined)
    if (link) links.set(file, link)
  }
  return links
}

/** Removes the files behind these photos; returns how many removals Storage refused. */
export async function removePhotoFiles(db: SupabaseClient, files: PhotoFile[]): Promise<string[]> {
  const problems: string[] = []
  const privatePaths = files.flatMap((f) => (f.storage_path ? [f.storage_path] : []))
  const legacyPaths = files.flatMap((f) => (!f.storage_path && f.photo_url ? [legacyPath(f.photo_url)].filter((p): p is string => !!p) : []))
  for (const [bucket, paths] of [
    [PRIVATE_BUCKET, privatePaths],
    [LEGACY_BUCKET, legacyPaths],
  ] as const) {
    if (paths.length === 0) continue
    const { error } = await db.storage.from(bucket).remove(paths)
    if (error) problems.push(`${bucket}: ${error.message}`)
  }
  return problems
}

/** Every file in a trail's folder of the private bucket (the caller must be able to see the trail). */
export async function trailFolderPaths(db: SupabaseClient, trailId: string): Promise<string[]> {
  const paths: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(PRIVATE_BUCKET).list(trailId, { limit: 1000, offset })
    if (error) throw Object.assign(new Error(error.message), { code: 'storage' })
    paths.push(...data.filter((f) => f.id).map((f) => `${trailId}/${f.name}`))
    if (data.length < 1000) return paths
  }
}
