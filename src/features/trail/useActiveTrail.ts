/**
 * State behind the Active trail page: loads the trail, starts (or resumes) it with
 * startTrail, restores the user's ticked crumbs, and runs the crumb toggles and the
 * Finished / Save for later / Abort actions from @/lib/api/progress. A login that
 * expired mid-trail sends the user to /login and back here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  abortTrail,
  finishTrail,
  getMyStatus,
  getMyTickedCrumbs,
  ProgressError,
  progressErrorMessage,
  saveTrail,
  startTrail,
  toggleCrumb,
} from '@/lib/api/progress'
import { getTrail, type TrailDetail } from '@/lib/api/trails'
import type { UserSidequestStatus } from '@/types/db-values'

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; trail: TrailDetail; myStatus: UserSidequestStatus | null }

export type TrailAction = 'finish' | 'save' | 'abort'

/** getTrail throws the raw Supabase error; no code means the request never got through. */
function loadErrorMessage(error: unknown): string {
  if (error instanceof ProgressError) return error.message
  const code = (error as { code?: string } | null)?.code
  return code
    ? 'Something went wrong loading this trail. Please try again.'
    : 'We couldn’t reach Breadcrumb. Check your connection and try again.'
}

export function useActiveTrail(trailId: string) {
  const navigate = useNavigate()
  const goHere = `/trails/${trailId}/go`
  const toLogin = useCallback(
    () => navigate(`/login?next=${encodeURIComponent(goHere)}`, { replace: true }),
    [navigate, goHere],
  )

  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [pendingCrumbs, setPendingCrumbs] = useState<Set<string>>(new Set())
  const [crumbError, setCrumbError] = useState<string | null>(null)
  const [busy, setBusy] = useState<TrailAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Guards against double taps before React re-renders with the new state.
  const inFlight = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const trail = await getTrail(trailId)
        if (cancelled) return
        if (!trail) return setLoad({ status: 'not_found' })
        // Opening the page starts the trail, or resumes it; a finished trail stays finished.
        await startTrail(trailId)
        const [myStatus, ticks] = await Promise.all([getMyStatus(trailId), getMyTickedCrumbs(trailId)])
        if (cancelled) return
        setTicked(ticks)
        setLoad({ status: 'ready', trail, myStatus })
      } catch (error) {
        if (cancelled) return
        if (error instanceof ProgressError && error.code === 'not_signed_in') return toLogin()
        setLoad({ status: 'error', message: loadErrorMessage(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [trailId, attempt, toLogin])

  const retry = () => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  /** Ticks or unticks a crumb right away, then saves; undoes it if saving fails. */
  async function toggle(crumbId: string) {
    if (inFlight.current.has(crumbId)) return
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
    setPendingCrumbs((prev) => new Set(prev).add(crumbId))
    setCrumbError(null)
    try {
      await toggleCrumb(crumbId, done)
    } catch (error) {
      apply(!done)
      if (error instanceof ProgressError && error.code === 'not_signed_in') toLogin()
      else setCrumbError(progressErrorMessage(error))
    } finally {
      inFlight.current.delete(crumbId)
      setPendingCrumbs((prev) => {
        const next = new Set(prev)
        next.delete(crumbId)
        return next
      })
    }
  }

  async function run(action: TrailAction) {
    if (inFlight.current.has('action')) return
    inFlight.current.add('action')
    setBusy(action)
    setActionError(null)
    try {
      if (action === 'finish') {
        await finishTrail(trailId)
        navigate(`/trails/${trailId}/rate`, { replace: true })
      } else if (action === 'save') {
        await saveTrail(trailId)
        navigate('/saved', { replace: true })
      } else {
        await abortTrail(trailId)
        navigate(`/trails/${trailId}`, { replace: true })
      }
    } catch (error) {
      if (error instanceof ProgressError && error.code === 'not_signed_in') return toLogin()
      setActionError(progressErrorMessage(error))
      setBusy(null)
    } finally {
      inFlight.current.delete('action')
    }
  }

  return { load, retry, ticked, pendingCrumbs, crumbError, toggle, busy, actionError, run }
}
