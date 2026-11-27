/**
 * Your status on one trail (saved, in progress, finished…) and the trail page's Start
 * and Save buttons, with the same rules as the website's useTrailActions: Save only
 * before you've started; signed out, both buttons open Log in.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import type { UserSidequestStatus } from '@breadcrumb/contracts'
import { api } from './api'
import { useSession } from './session'

type Busy = 'start' | 'save' | null

export function useTrailActions(trailId: string) {
  const { session, loading: sessionLoading } = useSession()
  const router = useRouter()
  const userId = session?.user.id ?? null
  // Tagged with the user it was loaded for, so a different account never sees a stale status.
  const [loaded, setLoaded] = useState<{ userId: string; status: UserSidequestStatus | null } | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!api || !userId) return
    let cancelled = false
    api.getMyProgress(trailId).then(
      ({ status }) => !cancelled && setLoaded({ userId, status }),
      () => !cancelled && setLoaded({ userId, status: null }),
    )
    return () => {
      cancelled = true
    }
  }, [trailId, userId])

  const status = userId && loaded?.userId === userId ? loaded.status : null
  const statusLoading = sessionLoading || (userId !== null && loaded?.userId !== userId)

  const run = useCallback(
    async (action: Exclude<Busy, null>, call: () => Promise<{ status: UserSidequestStatus | null }>) => {
      if (!userId) {
        router.push('/sign-in')
        return
      }
      setBusy(action)
      setError(null)
      try {
        const next = await call()
        setLoaded({ userId, status: next.status })
      } catch {
        setError('That didn’t go through. Check your connection and try again.')
      } finally {
        setBusy(null)
      }
    },
    [userId, router],
  )

  return {
    status,
    statusLoading,
    busy,
    error,
    /** One progress row per person per trail, so Save only makes sense before you start. */
    canSave: status === null || status === 'saved' || status === 'aborted',
    start: () => run('start', () => api!.trailAction(trailId, 'start')),
    toggleSave: () => run('save', () => (status === 'saved' ? api!.unsaveTrail(trailId) : api!.saveTrail(trailId))),
  }
}
