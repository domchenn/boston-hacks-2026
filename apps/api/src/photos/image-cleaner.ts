/**
 * Turns an uploaded photo into a clean JPEG before it is stored (M16a): decodes it
 * (proving it really is a JPEG, PNG, WebP or AVIF image), applies the camera's
 * rotation, shrinks it to at most 1600 px on its longest side and re-encodes it.
 * sharp writes no metadata unless asked, so GPS location, camera details and every
 * other EXIF / XMP / IPTC field are dropped. Used by PhotosService.
 *
 * iPhone HEIC can't be decoded here (the prebuilt image library has no HEVC), so it
 * is refused with a readable message; browsers usually convert it to JPEG first.
 */
import { PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common'
import sharp from 'sharp'

/** Longest side of a stored photo, as the web already shrinks to. */
export const MAX_SIDE = 1600
/** Largest upload accepted (the storage bucket's own limit). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
/** Refuse absurd dimensions before decoding, so one upload can't exhaust memory. */
const MAX_INPUT_PIXELS = 50_000_000
const FORMATS = new Set(['jpeg', 'png', 'webp', 'heif'])
export const UNSUPPORTED = 'Use a JPEG, PNG or WebP photo.'

// One image at a time and no cache: the API is small and photos are occasional.
sharp.concurrency(1)
sharp.cache(false)

export async function cleanImage(input: Buffer): Promise<Buffer> {
  if (input.length > MAX_UPLOAD_BYTES) throw new PayloadTooLargeException('That photo is too big (max 5 MB).')
  const options = { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' as const }
  let format: string | undefined
  try {
    format = (await sharp(input, options).metadata()).format
  } catch {
    throw new UnsupportedMediaTypeException(UNSUPPORTED)
  }
  if (!format || !FORMATS.has(format)) throw new UnsupportedMediaTypeException(UNSUPPORTED)
  try {
    return await sharp(input, options)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch {
    // e.g. HEIC (HEVC) or a damaged file: the header read but the pixels didn't.
    throw new UnsupportedMediaTypeException(UNSUPPORTED)
  }
}
