/**
 * Loads a trail's public photos (getTrailPhotos from @/lib/api/photos) and keeps the
 * list in sync after you add or delete one. Also turns photo API errors into
 * friendly text. Used by TrailPhotos (Trail detail) and MyTrailPhotos (Rate page).
 */

import { useCallback, useEffect, useState } from 'react'
import { getTrailPhotos, type TrailPhoto } from '@/lib/api/photos'

/** Text to show for anything the photo functions threw (most already throw a friendly message). */
export function photoErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/failed to fetch|network/i.test(message)) return 'No connection. Check your internet and try again.'
  return message || 'Something went wrong with that photo. Try again.'
}

type State = { trailId: string; photos?: TrailPhoto[]; error?: string }

export function useTrailPhotos(trailId: string) {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    let cancelled = false
    getTrailPhotos(trailId).then(
      (photos) => !cancelled && setState({ trailId, photos }),
      (error: unknown) => !cancelled && setState({ trailId, error: photoErrorMessage(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [trailId])

  const current = state?.trailId === trailId ? state : null

  /** Put a just-uploaded photo at the front (the list is newest first). */
  const add = useCallback(
    (photo: TrailPhoto) =>
      setState((s) => (s?.trailId === trailId ? { trailId, photos: [photo, ...(s.photos ?? [])] } : s)),
    [trailId],
  )

  /** Drop a deleted photo from the list. */
  const remove = useCallback(
    (photoId: string) =>
      setState((s) => (s?.trailId === trailId && s.photos ? { ...s, photos: s.photos.filter((p) => p.id !== photoId) } : s)),
    [trailId],
  )

  return { photos: current?.photos ?? [], loading: current === null, error: current?.error ?? null, add, remove }
}
