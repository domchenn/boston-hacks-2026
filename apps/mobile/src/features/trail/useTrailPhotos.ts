/**
 * A trail's photos you can see (GET /v1/trails/:id/photos), for the trail page and the
 * active trail's stops. add() takes a photo or picks one from the library, shrinks it
 * to 1600 px as a fresh JPEG on the phone (under the API's 5 MB limit, with no location
 * or camera data; the API cleans it again) and uploads it, at a stop ("At <place>") or
 * for the whole trail. remove() deletes one of yours. Adding needs a saved, started or
 * finished trail (the API checks).
 */
import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { TrailPhoto, TrailStop } from '@breadcrumb/contracts'
import type { PhotoSource } from '@/components/PhotoStrip'
import { api, statusOf } from '@/lib/api'


/** Longest side of an uploaded photo, as the API stores it. */
const MAX_SIDE = 1600

/** Asks for the camera or the library, then returns a small clean JPEG's file URI, or null if cancelled. */
async function pickPhoto(source: PhotoSource): Promise<string | null | 'denied'> {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return 'denied'
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  const asset = result.canceled ? null : result.assets[0]
  if (!asset) return null
  const context = ImageManipulator.manipulate(asset.uri)
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE })
  }
  const image = await context.renderAsync()
  const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG })
  return saved.uri
}

export function useTrailPhotos(trailId: string, userId: string | null) {
  const [photos, setPhotos] = useState<TrailPhoto[]>([])
  /** The stop a photo is uploading for, if any. */
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reloaded whenever the screen comes back into view (e.g. after adding photos on the trail).
  useFocusEffect(
    useCallback(() => {
      if (!api) return
      let cancelled = false
      api.getTrailPhotos(trailId).then(
        (all) => !cancelled && setPhotos(all),
        () => undefined,
      )
      return () => {
        cancelled = true
      }
    }, [trailId]),
  )

  const add = useCallback(
    async (stop: TrailStop | null, source: PhotoSource) => {
      if (!api) return
      setError(null)
      let uri: string | null | 'denied'
      try {
        uri = await pickPhoto(source)
      } catch {
        setError('Couldn’t open that photo. Try another one.')
        return
      }
      if (uri === 'denied') {
        setError(source === 'camera' ? 'Allow camera access in Settings to take photos.' : 'Allow photo access in Settings to add photos.')
        return
      }
      if (!uri) return
      setUploading(stop?.id ?? 'trail')
      try {
        const image = await (await fetch(uri)).blob()
        const photo = await api.addTrailPhoto(
          trailId,
          image,
          stop ? { stopId: stop.id, caption: `At ${stop.placeName}`.slice(0, 300) } : {},
        )
        setPhotos((prev) => [photo, ...prev])
      } catch (err) {
        setError(statusOf(err) === 413 ? 'That photo is too big. Try another one.' : 'Your photo didn’t upload. Check your connection and try again.')
      } finally {
        setUploading(null)
      }
    },
    [trailId],
  )

  const remove = useCallback(async (photo: TrailPhoto) => {
    if (!api) return
    const before = photos
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    try {
      await api.deletePhoto(photo.id)
    } catch {
      setPhotos(before)
      setError('Couldn’t delete that photo. Try again.')
    }
  }, [photos])

  /** Whether a photo is one of yours (you can delete it). */
  const isMine = useCallback((photo: TrailPhoto) => userId !== null && photo.uploader?.id === userId, [userId])

  return { photos, uploading, error, add, remove, isMine }
}
