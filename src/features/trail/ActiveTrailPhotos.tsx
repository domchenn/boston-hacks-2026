/**
 * Photos during an active trail (PRD §5.4, task D5):
 * - CrumbPhotoButton: a camera button on a ticked crumb that attaches a proof
 *   photo (uploadCrumbPhoto). Shows a thumbnail once added.
 * - TrailPhotosPanel: "Photos" card with an Add photos button (addTrailPhoto)
 *   and the trail's photos so far (getTrailPhotos). These are public on the trail.
 * On phones the file picker offers the camera. Upload logic: @/lib/api/photos.
 */

import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, LoaderCircle } from 'lucide-react'
import { addTrailPhoto, getTrailPhotos, uploadCrumbPhoto, type TrailPhoto } from '@/lib/api/photos'
import { cn } from '@/lib/utils'

/** Hidden file input opened by a button; calls onPick with the chosen image. */
function usePhotoPicker(onPick: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null)
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = '' // allow picking the same file again
        if (file) onPick(file)
      }}
    />
  )
  return { input, open: () => inputRef.current?.click() }
}

/** Camera button on a ticked crumb: adds a proof photo, then shows its thumbnail. */
export function CrumbPhotoButton({ crumbId, label, onError }: { crumbId: string; label: string; onError: (message: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const picker = usePhotoPicker(async (file) => {
    setBusy(true)
    try {
      setUrl(await uploadCrumbPhoto(crumbId, file))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Couldn’t upload that photo.')
    } finally {
      setBusy(false)
    }
  })

  return (
    <>
      {picker.input}
      <button
        type="button"
        onClick={picker.open}
        disabled={busy}
        className={cn(
          'grid size-11 flex-none place-items-center overflow-hidden rounded-[var(--radius-sm)] border border-line bg-white text-ink-2',
          'cursor-pointer hover:bg-paper focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-wait',
        )}
        aria-label={url ? `Replace the photo for “${label}”` : `Add a photo for “${label}”`}
      >
        {busy ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <Camera aria-hidden className="size-5" />
        )}
      </button>
    </>
  )
}

/** "Photos" card on the Active trail page: add public photos and see the trail's photos. */
export function TrailPhotosPanel({ trailId }: { trailId: string }) {
  const [photos, setPhotos] = useState<TrailPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getTrailPhotos(trailId)
      .then((list) => {
        if (!cancelled) setPhotos(list)
      })
      .catch(() => {
        // Not essential: the panel still lets people add photos.
      })
    return () => {
      cancelled = true
    }
  }, [trailId])

  const picker = usePhotoPicker(async (file) => {
    setBusy(true)
    setError(null)
    try {
      const photo = await addTrailPhoto(trailId, file)
      setPhotos((list) => [photo, ...list])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t upload that photo.')
    } finally {
      setBusy(false)
    }
  })

  return (
    <section aria-labelledby="trail-photos-title" className="mt-4 rounded-card border border-line bg-white px-4 py-3.5">
      {picker.input}
      <div className="flex items-center justify-between gap-3">
        <h2 id="trail-photos-title" className="m-0 text-base font-bold">
          Photos
        </h2>
        <button type="button" className="btn btn--sm btn--secondary" onClick={picker.open} aria-disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />}
          {busy ? 'Uploading…' : 'Add photos'}
        </button>
      </div>
      <p className="mt-1 mb-0 text-sm text-muted-foreground">Photos you add here show on the trail for everyone.</p>
      {error ? (
        <p role="alert" className="mt-2 mb-0 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}
      {photos.length > 0 ? (
        <ul className="m-0 mt-3 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-sand">
              <img
                src={photo.url}
                alt={photo.caption ?? `Photo by ${photo.uploader?.display_name ?? photo.uploader?.username ?? 'a trailgoer'}`}
                loading="lazy"
                className="size-full object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
