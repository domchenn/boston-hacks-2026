/**
 * One-time location for Explore's Nearby tab. Asks the browser only when called
 * with `enabled` (i.e. when the tab is opened), keeps the position in React state
 * only (never stored or sent), and exposes `retry` for "Try again". Used by
 * NearbyPanel.tsx (task G7).
 */
import { useCallback, useEffect, useState } from 'react'
import type { Position } from './nearby'

export type NearbyLocation =
  | { status: 'asking' }
  | { status: 'on'; position: Position }
  /** The user (or the browser's settings) said no. */
  | { status: 'denied' }
  /** No fix: weak signal, timeout, or a device without location. */
  | { status: 'unavailable' }
  /** No geolocation here, or the page isn't secure (https:// or localhost). */
  | { status: 'unsupported' }

const supported = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.geolocation) && typeof window !== 'undefined' && window.isSecureContext

export function useNearbyLocation(enabled: boolean): NearbyLocation & { retry: () => void } {
  const [state, setState] = useState<NearbyLocation>(() => (supported() ? { status: 'asking' } : { status: 'unsupported' }))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled || !supported()) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        !cancelled &&
        setState({ status: 'on', position: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
      (error) => !cancelled && setState({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      // A rough, recent fix is plenty for "0.4 mi away" and comes back faster.
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    )
    return () => {
      cancelled = true
    }
  }, [enabled, attempt])

  const retry = useCallback(() => {
    setState(supported() ? { status: 'asking' } : { status: 'unsupported' })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, retry }
}
