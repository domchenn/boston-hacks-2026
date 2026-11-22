/**
 * Trail photos (quest_photos via @/lib/api/photos):
 * - TrailPhotos: the "Photos" section on Trail detail, a grid of everyone's public
 *   photos that opens a viewer. Renders nothing while loading or when there are none.
 * - MyTrailPhotos: "Your photos" on the Rate / Finished page, the photos you added
 *   to this trail plus an Add photos button (addTrailPhoto, several at once).
 */

import { useId, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { addTrailPhoto } from '@/lib/api/photos'
import { TrailPhotoGrid } from './TrailPhotoGrid'
import { photoErrorMessage, useTrailPhotos } from './useTrailPhotos'

export function TrailPhotos({ trailId, trailTitle }: { trailId: string; trailTitle: string }) {
  const headingId = useId()
  const { photos, remove } = useTrailPhotos(trailId)
  if (photos.length === 0) return null

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mt-8 text-xl font-bold tracking-[var(--tracking-tight)] md:mt-10">
        Photos <span className="font-semibold text-muted-foreground">{photos.length}</span>
      </h2>
      <p className="mt-1 text-base text-ink-2">From people who've done this trail.</p>
      <TrailPhotoGrid photos={photos} trailTitle={trailTitle} limit={8} onDeleted={remove} className="mt-4" />
    </section>
  )
}

export function MyTrailPhotos({ trailId, trailTitle, userId }: { trailId: string; trailTitle: string; userId: string }) {
  const headingId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const { photos, add, remove } = useTrailPhotos(trailId)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mine = photos.filter((photo) => photo.uploader?.id === userId)

  async function upload(files: FileList | null) {
    const images = [...(files ?? [])].filter((file) => file.type.startsWith('image/'))
    if (inputRef.current) inputRef.current.value = ''
    if (images.length === 0) {
      if (files?.length) setError('Pick a photo (an image file).')
      return
    }
    setError(null)
    setProgress({ done: 0, total: images.length })
    for (const [i, file] of images.entries()) {
      try {
        add(await addTrailPhoto(trailId, file))
        setProgress({ done: i + 1, total: images.length })
      } catch (err) {
        setError(photoErrorMessage(err))
        break
      }
    }
    setProgress(null)
  }

  const addTile = (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={progress !== null}
      className="grid aspect-square w-full place-items-center rounded-[14px] border-2 border-dashed border-line-strong bg-white text-ink-2 transition-colors outline-none hover:border-crumb hover:text-crumb-strong focus-visible:shadow-[var(--focus-ring)] disabled:cursor-wait disabled:opacity-60"
    >
      <span className="grid justify-items-center gap-1.5 px-2 text-center text-sm font-semibold">
        <ImagePlus aria-hidden className="size-6" />
        {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : 'Add photos'}
      </span>
    </button>
  )

  return (
    <section aria-labelledby={headingId} className="mt-5">
      <h2 id={headingId} className="text-base font-semibold">
        Your photos <span className="font-normal text-muted-foreground">(optional)</span>
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">They post to the trail page right away, for everyone to see.</p>
      <TrailPhotoGrid photos={mine} trailTitle={trailTitle} onDeleted={remove} trailing={addTile} className="mt-2.5" />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => upload(event.target.files)}
      />
      <p role="status" className="sr-only">
        {progress ? `Uploading photo ${progress.done + 1} of ${progress.total}` : ''}
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-crumb-deep">
          {error}
        </p>
      ) : null}
    </section>
  )
}
