/**
 * Trail photos: a private proof photo on a crumb (checklist_completions.photo_url)
 * and public photos from an outing (quest_photos), stored in the Supabase
 * Storage bucket `trail-photos` under a folder named after the user's id.
 *
 * Owner: Dom (task D5). These are agreed signatures so other screens (Jason's
 * Trail detail / Finished photos, Gio's Active trail camera buttons) can use
 * them now. Fill in the bodies; don't rename them.
 */

import type { TrailCreator } from '@/lib/api/trails'

export type TrailPhoto = {
  id: string
  url: string
  caption: string | null
  createdAt: string
  uploader: TrailCreator | null
}

const notYet = (name: string) => () =>
  Promise.reject(new Error(`${name}() is not implemented yet (src/lib/api/photos.ts)`))

/** Upload a proof photo for a crumb you've ticked (ticks it if needed). Returns the photo URL. */
export const uploadCrumbPhoto: (crumbId: string, file: File) => Promise<string> = notYet('uploadCrumbPhoto')

/** Add a public photo to a trail you've started, saved or finished. */
export const addTrailPhoto: (trailId: string, file: File, caption?: string) => Promise<TrailPhoto> = notYet('addTrailPhoto')

/** Public photos on a trail, newest first. */
export const getTrailPhotos: (trailId: string) => Promise<TrailPhoto[]> = notYet('getTrailPhotos')

/** Delete one of your own trail photos (row + file). */
export const deletePhoto: (photoId: string) => Promise<void> = notYet('deletePhoto')
