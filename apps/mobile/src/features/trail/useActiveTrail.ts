/**
 * State behind the active trail (/trail/:id/go), following the website's useActiveTrail:
 * opening it starts or resumes the trail, restores your ticked crumbs, ticks crumbs
 * straight away (undone if saving fails) and runs Finish. Which stop you're on is kept
 * on this phone only (AsyncStorage), else it's the first stop with crumbs left.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TrailDetail } from '@breadcrumb/contracts'
import { api, statusOf } from '@/lib/api'

type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; trail: TrailDetail; stopIndex: number }

const stopKey = (userId: string, trailId: string) => `active-stop:${userId}:${trailId}`

/** The stop to show first: the saved one if it's still valid, else the first with crumbs left. */
function firstStop(trail: TrailDetail, ticked: Set<string>, saved: string | null): number {
  const n = Number(saved)
  if (saved !== null && Number.isInteger(n) && n >= 0 && n < trail.stops.length) return n
  return Math.max(0, trail.stops.findIndex((s) => s.crumbs.some((c) => !ticked.has(c.id))))
}

export function useActiveTrail(trailId: string, userId: string) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  // Guards against double taps before React re-renders.
  const inFlight = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!api) return
    const client = api
    let cancelled = false
    ;(async () => {
      try {
        const trail = await client.getTrail(trailId)
        if (cancelled) return
        if (!trail) return setLoad({ status: 'missing' })
        // Starts the trail, or resumes it; a finished trail stays finished.
        await client.trailAction(trailId, 'start')
        const [crumbIds, saved] = await Promise.all([
          client.getTickedCrumbs(trailId),
          AsyncStorage.getItem(stopKey(userId, trailId)).catch(() => null),
        ])
        if (cancelled) return
        const ticks = new Set(crumbIds)
        setTicked(ticks)
        setLoad({ status: 'ready', trail, stopIndex: firstStop(trail, ticks, saved) })
      } catch (err) {
        if (!cancelled) setLoad(statusOf(err) === 404 ? { status: 'missing' } : { status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [trailId, userId, attempt])

  const retry = () => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const goToStop = useCallback(
    (index: number) => {
      setLoad((prev) => (prev.status === 'ready' ? { ...prev, stopIndex: index } : prev))
      void AsyncStorage.setItem(stopKey(userId, trailId), String(index)).catch(() => undefined)
    },
    [userId, trailId],
  )

  /** Ticks or unticks a crumb right away, then saves; undoes it if saving fails. */
  async function toggle(crumbId: string) {
    if (!api || inFlight.current.has(crumbId)) return
    inFlight.current.add(crumbId)
    const done = !ticked.has(crumbId)
    const apply = (on: boolean) =>
      setTicked((prev) => {
        const next = new Set(prev)
        if (on) next.add(crumbId)
        else next.delete(crumbId)
        return next
      })
    apply(done)
    setError(null)
    try {
      await api.setCrumb(crumbId, done)
    } catch {
      apply(!done)
      setError('That crumb didn’t save. Check your connection and try again.')
    } finally {
      inFlight.current.delete(crumbId)
    }
  }

  /** Marks the trail finished. Resolves true when it worked. */
  async function finish(): Promise<boolean> {
    if (!api || inFlight.current.has('finish')) return false
    inFlight.current.add('finish')
    setFinishing(true)
    setError(null)
    try {
      await api.trailAction(trailId, 'finish')
      void AsyncStorage.removeItem(stopKey(userId, trailId)).catch(() => undefined)
      return true
    } catch {
      setError('Couldn’t finish the trail. Check your connection and try again.')
      return false
    } finally {
      inFlight.current.delete('finish')
      setFinishing(false)
    }
  }

  return { load, retry, ticked, error, toggle, goToStop, finish, finishing }
}
