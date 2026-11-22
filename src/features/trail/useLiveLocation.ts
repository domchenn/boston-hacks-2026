/**
 * The user's live position for the Active trail page, via
 * navigator.geolocation.watchPosition. Only this page asks for location (PRD:
 * location is live only). The position lives in React state and is never
 * stored or sent anywhere; the watch stops when the page closes.
 */
import { useEffect, useState } from 'react'

export type LiveLocation = { latitude: number; longitude: number }

export type LocationState =
  /** Waiting for the browser (and the user's permission). */
  | { status: 'asking' }
  | { status: 'on'; location: LiveLocation }
  /** The user said no (or the browser blocks it). */
  | { status: 'denied' }
  /** No fix right now: weak signal, timeout, or a device without location. */
  | { status: 'unavailable' }
  /** No geolocation here at all, or not over HTTPS. */
  | { status: 'unsupported' }

function initialState(): LocationState {
  // Check the value, not just the key: some browsers expose an empty `geolocation`.
  if (typeof navigator === 'undefined' || !navigator.geolocation) return { status: 'unsupported' }
  // Browsers only allow location on secure pages (https:// or localhost).
  if (typeof window !== 'undefined' && !window.isSecureContext) return { status: 'unsupported' }
  return { status: 'asking' }
}

export function useLiveLocation(enabled: boolean): LocationState {
  const [state, setState] = useState<LocationState>(initialState)

  useEffect(() => {
    if (!enabled || initialState().status === 'unsupported') return
    const watchId = navigator.geolocation.watchPosition(
      (position) =>
        setState({
          status: 'on',
          location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setState({ status: 'denied' })
        // Keep showing the last known position through a brief signal loss.
        else setState((s) => (s.status === 'on' ? s : { status: 'unavailable' }))
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  return state
}
