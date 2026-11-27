/**
 * Photos contract (M16a): a trail's public photos (GET /v1/trails/:trailId/photos,
 * sign-in optional), adding one (POST, the image itself as the request body, with an
 * optional caption and stop in the query) and deleting your own
 * (DELETE /v1/photos/:photoId). The API re-encodes every upload as a clean JPEG with
 * no location or camera data. Same data as the web's lib/api/photos.ts.
 */
import { z } from 'zod'
import { TrailCreator } from './trails.js'

const Uuid = z.uuid()

export const TrailPhoto = z.object({
  id: Uuid,
  url: z.string(),
  caption: z.string().nullable(),
  createdAt: z.string(),
  /** The stop it was taken at, if it was added from a stop on Active trail. */
  stopId: Uuid.nullable(),
  uploader: TrailCreator.nullable(),
})
export type TrailPhoto = z.infer<typeof TrailPhoto>

/** Newest first. */
export const TrailPhotoList = z.object({ photos: z.array(TrailPhoto) })
export type TrailPhotoList = z.infer<typeof TrailPhotoList>

/** POST /v1/trails/:trailId/photos query. The stop must be on this trail. */
export const AddPhotoQuery = z
  .object({ caption: z.string().max(300).optional(), stopId: Uuid.optional() })
  .strict()
export type AddPhotoQuery = z.infer<typeof AddPhotoQuery>

/** POST /v1/trails/:trailId/photos response (201). */
export const PhotoAdded = z.object({ photo: TrailPhoto })
export type PhotoAdded = z.infer<typeof PhotoAdded>

export const PhotoParams = z.object({ photoId: Uuid })
export type PhotoParams = z.infer<typeof PhotoParams>

/** DELETE /v1/photos/:photoId response. */
export const PhotoDeleted = z.object({ id: Uuid, deleted: z.literal(true) })
export type PhotoDeleted = z.infer<typeof PhotoDeleted>

/** Image types the upload accepts as its Content-Type (HEIC is refused after decoding). */
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'] as const
