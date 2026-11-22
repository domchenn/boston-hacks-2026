/**
 * useStopPhotos(): the signed-in user's own photos on a trail, grouped by stop
 * (quest_photos.stop_id), plus add() to upload one or more photos for a stop
 * (captioned "At <place>"). With an outing, only that outing's photos show and new
 * ones are tagged with it. Used by Active trail's photo button on each stop.
 */

import { useEffect, useState } from 'react'
import { addTrailPhoto, getTrailPhotos, type TrailPhoto } from '@/lib/api/photos'

export function useStopPhotos(trailId: string, userId: string | null, outingId: string | null = null) {
  const [photos, setPhotos] = useState<TrailPhoto[]>([])
  const [busyStop, setBusyStop] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getTrailPhotos(trailId)
      .then((list) => !cancelled && setPhotos(list.filter((p) => p.uploader?.id === userId && (!outingId || p.outingId === outingId))))
      .catch(() => undefined) // not essential: adding still works
    return () => {
      cancelled = true
    }
  }, [trailId, userId, outingId])

  async function add(stopId: string, placeName: string, files: File[]) {
    setBusyStop(stopId)
    setError(null)
    try {
      for (const file of files) {
        const photo = await addTrailPhoto(trailId, file, `At ${placeName}`, stopId, outingId ?? undefined)
        setPhotos((list) => [photo, ...list])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t upload that photo.')
    } finally {
      setBusyStop(null)
    }
  }

  const forStop = (stopId: string) => photos.filter((p) => p.stopId === stopId)
  return { forStop, add, busyStop, error }
}
