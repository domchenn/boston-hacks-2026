/**
 * Square photo thumbnails that open a full-screen viewer (a native <dialog>):
 * the photo, who posted it and when, its caption, previous / next (buttons or
 * arrow keys) and, for your own photos, Delete (deletePhoto). Shared by the
 * Trail detail Photos section and the Rate page's "Your photos".
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { Link } from 'react-router'
import { ReportButton } from '@/features/reports/ReportButton'
import { formatShortDate } from '@/components/trailFormat'
import { deletePhoto, type TrailPhoto } from '@/lib/api/photos'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'
import { photoErrorMessage } from './useTrailPhotos'

const uploaderName = (photo: TrailPhoto) => photo.uploader?.display_name || photo.uploader?.username || 'Someone'

/** Alt text: the caption if there is one, otherwise who posted it and when. */
const altText = (photo: TrailPhoto, trailTitle: string) =>
  photo.caption || `Photo from ${trailTitle} by ${uploaderName(photo)}, ${formatShortDate(photo.createdAt)}`

type ViewerProps = {
  photos: TrailPhoto[]
  index: number
  trailTitle: string
  onIndex: (index: number) => void
  onClose: () => void
  onDeleted?: (photoId: string) => void
}

function PhotoViewer({ photos, index, trailTitle, onIndex, onClose, onDeleted }: ViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { session } = useSession()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photo = photos[index]
  const mine = Boolean(session && photo?.uploader?.id === session.user.id)
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const go = (next: number) => {
    setConfirming(false)
    setError(null)
    onIndex(next)
  }

  async function remove() {
    if (!photo) return
    setBusy(true)
    setError(null)
    try {
      await deletePhoto(photo.id)
      setConfirming(false)
      onDeleted?.(photo.id)
      if (photos.length === 1) dialogRef.current?.close()
      else if (index === photos.length - 1) onIndex(index - 1)
    } catch (err) {
      setError(photoErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!photo) return null
  const name = uploaderName(photo)

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && dialogRef.current.close()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && hasPrev) go(index - 1)
        if (event.key === 'ArrowRight' && hasNext) go(index + 1)
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-white backdrop:bg-ink/90"
    >
      <div className="mx-auto flex h-full max-w-[1100px] flex-col px-4 pt-3 pb-4 md:px-6 md:pt-5 md:pb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white/80">
            {index + 1} / {photos.length}
          </span>
          <button
            type="button"
            className="icon-btn icon-btn--float"
            aria-label="Close photo"
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            <X aria-hidden />
          </button>
        </div>

        <div className="relative mt-3 min-h-0 flex-1">
          {/* Fills the space between the top bar and the details, keeping the photo's shape. */}
          <img src={photo.url} alt={altText(photo, trailTitle)} className="absolute inset-0 size-full object-contain" />
          {hasPrev ? (
            <button
              type="button"
              className="icon-btn icon-btn--float absolute top-1/2 left-0 -translate-y-1/2 md:-left-2"
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft aria-hidden />
            </button>
          ) : null}
          {hasNext ? (
            <button
              type="button"
              className="icon-btn icon-btn--float absolute top-1/2 right-0 -translate-y-1/2 md:-right-2"
              aria-label="Next photo"
              onClick={() => go(index + 1)}
            >
              <ChevronRight aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {photo.uploader?.avatar_url ? (
              <img src={photo.uploader.avatar_url} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-crumb-tint text-sm font-extrabold text-crumb-strong">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {photo.uploader?.username ? (
                  <Link to={`/u/${photo.uploader.username}`} className="text-white hover:underline">
                    {name}
                  </Link>
                ) : (
                  name
                )}
                <span className="font-normal text-white/70"> · {formatShortDate(photo.createdAt)}</span>
              </p>
              {photo.caption ? <p className="text-sm text-white/85">{photo.caption}</p> : null}
            </div>
          </div>

          {mine && onDeleted ? (
            confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Delete this photo?</span>
                <button type="button" className="btn btn--sm" onClick={remove} disabled={busy}>
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
                <button type="button" className="btn btn--sm btn--secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white"
                onClick={() => setConfirming(true)}
              >
                <Trash2 aria-hidden className="size-4" />
                Delete
              </button>
            )
          ) : (
            <ReportButton targetType="photo" targetId={photo.id} ownerId={photo.uploader?.id} what="this photo" tone="dark" />
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-sm font-medium text-white">
            {error}
          </p>
        ) : null}
      </div>
    </dialog>
  )
}

type GridProps = {
  photos: TrailPhoto[]
  trailTitle: string
  /** Show at most this many tiles; the last one opens the viewer with "+N". */
  limit?: number
  /** Called after you delete one of your own photos in the viewer. */
  onDeleted?: (photoId: string) => void
  /** An extra tile after the photos (e.g. Add photos). */
  trailing?: ReactNode
  className?: string
}

export function TrailPhotoGrid({ photos, trailTitle, limit, onDeleted, trailing, className }: GridProps) {
  const [open, setOpen] = useState<number | null>(null)
  const shown = limit && photos.length > limit ? photos.slice(0, limit) : photos
  const hidden = photos.length - shown.length

  return (
    <>
      <ul className={cn('m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 md:gap-3', className)}>
        {shown.map((photo, i) => {
          const more = hidden > 0 && i === shown.length - 1
          return (
            <li key={photo.id}>
              <button
                type="button"
                className="group relative block aspect-square w-full overflow-hidden rounded-[14px] bg-sand outline-none focus-visible:shadow-[var(--focus-ring)]"
                aria-label={more ? `See all ${photos.length} photos` : `Open photo: ${altText(photo, trailTitle)}`}
                onClick={() => setOpen(i)}
              >
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
                {more ? (
                  <span className="absolute inset-0 grid place-items-center bg-ink/55 text-xl font-extrabold text-white">
                    +{hidden + 1}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {trailing ? <li>{trailing}</li> : null}
      </ul>
      {open !== null && photos.length > 0 ? (
        <PhotoViewer
          photos={photos}
          index={Math.min(open, photos.length - 1)}
          trailTitle={trailTitle}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onDeleted={onDeleted}
        />
      ) : null}
    </>
  )
}
