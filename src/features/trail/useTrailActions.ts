/**
 * The viewer's status on one trail (getMyStatus) and the Start / Save actions
 * from @/lib/api/progress. Once the trail is finished it also checks getMyRating so
 * the page can offer "Rate this trail" (not rated yet) or "Edit your rating".
 * Also loads the viewer's outings of the trail (getMyOutings: the one in progress
 * → "Continue trail", finished ones → history and "Do it again") and open invites
 * from friends to join an outing (respond accepts or declines). Start just opens
 * /trails/:id/go, which starts or resumes the outing.
 * Logged-out viewers are sent to /login?next=/trails/:id.
 * Used by TrailActions on the Trail detail page; one instance per page.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getMyOutingInvites, getMyOutings, respondToOuting, type Outing, type OutingInvite } from '@/lib/api/outings'
import { getMyStatus, saveTrail, unsaveTrail } from '@/lib/api/progress'
import { getMyRating } from '@/lib/api/ratings'
import { useSession } from '@/lib/useSession'
import type { UserSidequestStatus } from '@/types/db-values'
import { loginPath } from './trailLinks'

type Action = 'start' | 'save' | 'respond'

/** Turns API errors into something a person can act on. */
function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/not implemented/i.test(message)) return "That button isn't hooked up yet. It's coming soon."
  if (/network|fetch/i.test(message)) return 'No connection. Check your internet and try again.'
  return message || 'Something went wrong. Try again.'
}

/** The viewer's status on a trail plus the three actions. One instance per page. */
export function useTrailActions(trailId: string) {
  const { session, loading: sessionLoading } = useSession()
  const navigate = useNavigate()
  const [status, setStatus] = useState<{ trailId: string; value: UserSidequestStatus | null } | null>(null)
  const [rated, setRated] = useState<{ trailId: string; value: boolean } | null>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outings, setOutings] = useState<{ trailId: string; list: Outing[]; invites: OutingInvite[] } | null>(null)
  const [outingsAttempt, setOutingsAttempt] = useState(0)
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (sessionLoading || !userId) return
    let cancelled = false
    Promise.all([getMyOutings(trailId), getMyOutingInvites(trailId)]).then(
      ([list, invites]) => !cancelled && setOutings({ trailId, list, invites }),
      // Can't tell: show no history; Start still works (it starts or resumes on the next page).
      () => !cancelled && setOutings({ trailId, list: [], invites: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [trailId, userId, sessionLoading, outingsAttempt])

  useEffect(() => {
    if (sessionLoading || !userId) return
    let cancelled = false
    getMyStatus(trailId).then(
      (value) => !cancelled && setStatus({ trailId, value }),
      // Until progress.ts is filled in (task G2) this rejects; treat it as "no status yet".
      () => !cancelled && setStatus({ trailId, value: null }),
    )
    return () => {
      cancelled = true
    }
  }, [trailId, userId, sessionLoading])

  const current = userId && status?.trailId === trailId ? status.value : null
  const finished = current === 'completed'

  // Only finished trails can be rated, so only then ask whether this viewer already did.
  useEffect(() => {
    if (!finished) return
    let cancelled = false
    getMyRating(trailId).then(
      (rating) => !cancelled && setRated({ trailId, value: rating !== null }),
      // Can't tell: offer "Rate this trail"; the Rate page loads any existing rating anyway.
      () => !cancelled && setRated({ trailId, value: false }),
    )
    return () => {
      cancelled = true
    }
  }, [trailId, finished])

  /** null = not finished (nothing to rate) or still checking. */
  const hasRated = finished && rated?.trailId === trailId ? rated.value : null
  const mine = userId && outings?.trailId === trailId ? outings : null
  const myOutings = mine?.list ?? []
  const activeOuting =
    myOutings.find((o) => o.status === 'active' && o.members.some((m) => m.person.id === userId && m.status === 'joined')) ??
    null
  const statusLoading =
    sessionLoading ||
    (userId !== null && (status?.trailId !== trailId || outings?.trailId !== trailId)) ||
    (finished && hasRated === null)

  const run = useCallback(
    async (action: Action, call: () => Promise<void>, next: UserSidequestStatus | null) => {
      if (!userId) {
        navigate(loginPath(`/trails/${trailId}`))
        return false
      }
      setBusy(action)
      setError(null)
      try {
        await call()
        setStatus({ trailId, value: next })
        return true
      } catch (err) {
        setError(friendlyError(err))
        return false
      } finally {
        setBusy(null)
      }
    },
    [userId, trailId, navigate],
  )

  return {
    status: current,
    statusLoading,
    hasRated,
    /** Your outings of this trail, newest first (finished ones are your history). */
    outings: myOutings,
    activeOuting,
    invites: mine?.invites ?? [],
    busy,
    error,
    // The Active trail page starts a fresh outing, or resumes the one you're on.
    start: () => (userId ? navigate(`/trails/${trailId}/go`) : navigate(loginPath(`/trails/${trailId}`))),
    /** Join a friend's outing (then go), or say no thanks. */
    respond: async (invite: OutingInvite, accept: boolean) => {
      const ok = await run('respond', () => respondToOuting(invite.outingId, accept), current)
      if (ok && accept) navigate(`/trails/${trailId}/go`)
      else if (ok) setOutingsAttempt((n) => n + 1)
    },
    toggleSave: () =>
      current === 'saved'
        ? run('save', () => unsaveTrail(trailId), null)
        : run('save', () => saveTrail(trailId), 'saved'),
  }
}

export type TrailActionsState = ReturnType<typeof useTrailActions>
