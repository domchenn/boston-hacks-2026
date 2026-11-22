/**
 * Keeps the phone screen on while an active trail is open (Screen Wake Lock
 * API). Browsers drop the lock when the tab is hidden, so it's requested again
 * when the page comes back. Does nothing where the API isn't supported.
 * Used by ActiveTrailPage.
 */
import { useEffect } from 'react'

type WakeLockSentinelLike = { release: () => Promise<void> }
type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> }

export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
    if (!enabled || !wakeLock) return

    let sentinel: WakeLockSentinelLike | null = null
    let active = true

    const acquire = async () => {
      if (!active || document.visibilityState !== 'visible') return
      try {
        sentinel = await wakeLock.request('screen')
      } catch {
        // Denied (e.g. low battery mode): the screen just sleeps as usual.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release().catch(() => {})
    }
  }, [enabled])
}
