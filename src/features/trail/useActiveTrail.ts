/**
 * State behind the Active trail page. Opening the page starts an OUTING of the
 * trail (start_outing): it resumes the one you're on, or starts a fresh one,
 * which is how "Do it again" works after you've finished. The crumbs are the
 * outing's shared checklist, so friends on the same outing see each other's ticks
 * (kept in sync by subscribeToOuting). Crumb toggles are optimistic (one at a
 * time, or every crumb at a stop with setCrumbs). Actions: Finished (for everyone
 * on the outing), Save for later (the outing stays open to Continue), Stop (leave
 * the outing; the last one out ends it). Invite adds friends to this outing.
 * A login that expired mid-trail sends the user to /login and back here.
 * Data: @/lib/api/outings, @/lib/api/progress (Save for later).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  finishOuting,
  getOuting,
  getOutingTicks,
  inviteToOuting,
  leaveOuting,
  OutingError,
  setOutingCrumb,
  startOuting,
  subscribeToOuting,
  type Outing,
} from '@/lib/api/outings'
import { getMyStatus, ProgressError, progressErrorMessage, saveTrail } from '@/lib/api/progress'
import { getTrail, type TrailDetail } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import type { UserSidequestStatus } from '@/types/db-values'

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      trail: TrailDetail
      myStatus: UserSidequestStatus | null
    }

export type TrailAction = 'finish' | 'save' | 'abort'

function errorMessage(error: unknown): string {
  if (error instanceof OutingError || error instanceof ProgressError) return error.message
  return progressErrorMessage(error)
}

function isLoggedOut(error: unknown) {
  return (
    (error instanceof OutingError && error.code === 'not_signed_in') ||
    (error instanceof ProgressError && error.code === 'not_signed_in')
  )
}

/** getTrail throws the raw Supabase error; no code means the request never got through. */
function loadErrorMessage(error: unknown): string {
  if (error instanceof OutingError || error instanceof ProgressError) return error.message
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
  const [outing, setOuting] = useState<Outing | null>(null)
  /** Crumb id → who ticked it (null if unknown). */
  const [ticks, setTicks] = useState<Map<string, string | null>>(new Map())
  const [pendingCrumbs, setPendingCrumbs] = useState<Set<string>>(new Set())
  const [crumbError, setCrumbError] = useState<string | null>(null)
  const [busy, setBusy] = useState<TrailAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Guards against double taps before React re-renders with the new state.
  const inFlight = useRef<Set<string>>(new Set())
  const sync = useRef<ReturnType<typeof subscribeToOuting> | null>(null)
  const { session } = useSession()
  const myId = session?.user.id ?? null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const trail = await getTrail(trailId)
        if (cancelled) return
        if (!trail) return setLoad({ status: 'not_found' })
        // Opening the page starts an outing, or resumes the one you're on.
        const outingId = await startOuting(trailId)
        const [myStatus, current, ticked] = await Promise.all([
          getMyStatus(trailId),
          getOuting(outingId),
          getOutingTicks(outingId),
        ])
        if (cancelled) return
        setOuting(current)
        setTicks(ticked)
        setLoad({ status: 'ready', trail, myStatus })
      } catch (error) {
        if (cancelled) return
        if (isLoggedOut(error)) return toLogin()
        setLoad({ status: 'error', message: loadErrorMessage(error) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [trailId, attempt, toLogin])

  // Stay in step with friends on the same outing.
  const outingId = outing?.id ?? null
  useEffect(() => {
    if (!outingId) return
    let alive = true
    const refresh = async () => {
      try {
        const [current, ticked] = await Promise.all([getOuting(outingId), getOutingTicks(outingId)])
        if (!alive) return
        if (current) setOuting(current)
        // Keep crumbs you're saving right now as you set them.
        setTicks((prev) => {
          const next = new Map(ticked)
          for (const id of inFlight.current) {
            if (prev.has(id)) next.set(id, prev.get(id) ?? null)
            else next.delete(id)
          }
          return next
        })
      } catch {
        // A missed refresh is fine: the next ping or poll catches up.
      }
    }
    sync.current = subscribeToOuting(outingId, refresh)
    return () => {
      alive = false
      sync.current?.stop()
      sync.current = null
    }
  }, [outingId])

  const retry = () => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  /** Ticks or unticks a crumb right away, then saves; undoes it if saving fails. */
  function toggle(crumbId: string) {
    return setCrumb(crumbId, !ticks.has(crumbId))
  }

  /** Ticks (or unticks) several crumbs at once, e.g. "done here" on a stop. Already-right ones are skipped. */
  function setCrumbs(crumbIds: string[], done: boolean) {
    return Promise.all(crumbIds.filter((id) => ticks.has(id) !== done).map((id) => setCrumb(id, done)))
  }

  async function setCrumb(crumbId: string, done: boolean) {
    if (!outing || inFlight.current.has(crumbId)) return
    inFlight.current.add(crumbId)
    const apply = (on: boolean) =>
      setTicks((prev) => {
        const next = new Map(prev)
        if (on) next.set(crumbId, myId)
        else next.delete(crumbId)
        return next
      })
    apply(done)
    setPendingCrumbs((prev) => new Set(prev).add(crumbId))
    setCrumbError(null)
    try {
      await setOutingCrumb(outing.id, crumbId, done)
      sync.current?.ping()
    } catch (error) {
      apply(!done)
      if (isLoggedOut(error)) toLogin()
      else
        setCrumbError(
          error instanceof OutingError && error.code === 'gone'
            ? 'This outing has ended, so its crumbs can’t change.'
            : errorMessage(error),
        )
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
    if (!outing || inFlight.current.has('action')) return
    inFlight.current.add('action')
    setBusy(action)
    setActionError(null)
    try {
      if (action === 'finish') {
        await finishOuting(outing.id)
        sync.current?.ping()
        navigate(`/trails/${trailId}/rate`, { replace: true })
      } else if (action === 'save') {
        // The outing stays open, so "Continue trail" picks it back up.
        const finishedBefore = load.status === 'ready' && load.myStatus === 'completed'
        if (!finishedBefore) await saveTrail(trailId)
        navigate(finishedBefore ? `/trails/${trailId}` : '/saved', {
          replace: true,
        })
      } else {
        await leaveOuting(outing.id)
        sync.current?.ping()
        navigate(`/trails/${trailId}`, { replace: true })
      }
    } catch (error) {
      if (isLoggedOut(error)) return toLogin()
      setActionError(errorMessage(error))
      setBusy(null)
    } finally {
      inFlight.current.delete('action')
    }
  }

  /** Invite friends to this outing. Returns how many were invited. */
  async function invite(userIds: string[]) {
    if (!outing) return 0
    const count = await inviteToOuting(outing.id, userIds)
    const current = await getOuting(outing.id)
    if (current) setOuting(current)
    sync.current?.ping()
    return count
  }

  const ticked = new Set(ticks.keys())
  return {
    load,
    retry,
    outing,
    ticks,
    ticked,
    pendingCrumbs,
    crumbError,
    toggle,
    setCrumbs,
    busy,
    actionError,
    run,
    invite,
  }
}
