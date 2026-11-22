/**
 * Photos on Active trail, attached to a place (PRD §5.4):
 * - StopPhotoButton: the photo icon on the right of each stop. Opens the phone's
 *   photo library (several at once; the camera is still offered by the phone).
 * - StopPhotoStrip: thumbnails of the photos added at a stop.
 * Photos are public on the trail, like before. Loading and uploading: ./useStopPhotos.
 */

import { useRef } from 'react'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import type { TrailPhoto } from '@/lib/api/photos'
import { cn } from '@/lib/utils'

/** Photo-library button for one stop. */
export function StopPhotoButton({
  placeName,
  count,
  busy,
  onPick,
}: {
  placeName: string
  count: number
  busy: boolean
  onPick: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = '' // allow picking the same file again
          if (files.length) onPick(files)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          'relative grid size-11 flex-none cursor-pointer place-items-center rounded-full border border-line bg-white text-ink-2',
          'hover:bg-paper focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-wait',
        )}
        aria-label={`Attach photos at ${placeName}${count ? ` (${count} added)` : ''}`}
      >
        {busy ? <LoaderCircle aria-hidden className="size-5 animate-spin" /> : <ImagePlus aria-hidden className="size-5" />}
        {count > 0 && !busy ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-done text-[11px] font-bold text-white"
          >
            {count}
          </span>
        ) : null}
      </button>
    </>
  )
}

/** Thumbnails of the photos added at a stop. */
export function StopPhotoStrip({ photos, placeName }: { photos: TrailPhoto[]; placeName: string }) {
  if (photos.length === 0) return null
  return (
    <ul aria-label={`Your photos at ${placeName}`} className="m-0 mt-3 flex list-none gap-2 overflow-x-auto p-0">
      {photos.map((photo) => (
        <li key={photo.id} className="size-16 flex-none overflow-hidden rounded-[var(--radius-sm)] bg-sand">
          <img src={photo.url} alt={photo.caption ?? `Photo at ${placeName}`} loading="lazy" className="size-full object-cover" />
        </li>
      ))}
    </ul>
  )
}
