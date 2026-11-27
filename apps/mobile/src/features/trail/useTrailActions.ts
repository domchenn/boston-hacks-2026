/**
 * Your status on one trail (saved, in progress, finished…) and the trail page's Start
 * and Save buttons, with the same rules as the website's useTrailActions: Save only
 * before you've started; signed out, both buttons open Log in. Start (or Continue)
 * opens the active trail (/trail/:id/go).
 */
import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import type { UserSidequestStatus } from '@breadcrumb/contracts'
import { api } from '@/lib/api'
import { useSession } from '@/lib/session'

type Busy = 'start' | 'save' | null

export function useTrailActions(trailId: string) {
  const { session, loading: sessionLoading } = useSession()
  const router = useRouter()
  const userId = session?.user.id ?? null
  // Tagged with the user it was loaded for, so a different account never sees a stale status.
  const [loaded, setLoaded] = useState<{ userId: string; status: UserSidequestStatus | null } | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  // Reloaded whenever the page comes back into view (e.g. after finishing the trail).
  useFocusEffect(
    useCallback(() => {
      if (!api || !userId) return
      let cancelled = false
      api.getMyProgress(trailId).then(
        ({ status }) => !cancelled && setLoaded({ userId, status }),
        () => !cancelled && setLoaded((prev) => (prev?.userId === userId ? prev : { userId, status: null })),
      )
      return () => {
        cancelled = true
      }
    }, [trailId, userId]),
  )

  const status = userId && loaded?.userId === userId ? loaded.status : null
  const statusLoading = sessionLoading || (userId !== null && loaded?.userId !== userId)

  const run = useCallback(
    async (action: Exclude<Busy, null>, call: () => Promise<{ status: UserSidequestStatus | null }>) => {
      if (!userId) {
        router.push('/sign-in')
        return false
      }
      setBusy(action)
      setError(null)
      try {
        const next = await call()
        setLoaded({ userId, status: next.status })
        return true
      } catch {
        setError('That didn’t go through. Check your connection and try again.')
        return false
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
    /** Starts the trail (or picks it back up) and opens the active trail. */
    start: async () => {
      if (status === 'in_progress' || (await run('start', () => api!.trailAction(trailId, 'start')))) {
        router.push(`/trail/${trailId}/go`)
      }
    },
    toggleSave: () => run('save', () => (status === 'saved' ? api!.unsaveTrail(trailId) : api!.saveTrail(trailId))),
  }
}
