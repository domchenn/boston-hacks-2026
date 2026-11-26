/**
 * Loads what the people you follow made, finished or joined (loadFriendsActivity)
 * plus how many people you follow (to pick the right empty state). `reload()`
 * fetches again, e.g. after following someone. Used by FriendsActivity (You
 * page) and FriendsPanel (Explore Friends tab).
 */

import { useCallback, useEffect, useState } from 'react'
import { countFollowing, loadFriendsActivity, type FriendsActivity } from './api'

type Result = { key: string; activity?: FriendsActivity; following?: number; error?: string }

export function useFriendsActivity(viewerId: string | null, limit: number) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = viewerId ? `${viewerId}|${limit}|${attempt}` : null

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const [viewer, max] = key.split('|')
    Promise.all([loadFriendsActivity(Number(max)), countFollowing(viewer)]).then(
      ([activity, following]) => !cancelled && setResult({ key, activity, following }),
      (error: unknown) =>
        !cancelled && setResult({ key, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    )
    return () => {
      cancelled = true
    }
  }, [key])

  // While reloading, keep showing the last result for the same viewer (no flash of the skeleton).
  const current = key && result?.key.startsWith(`${viewerId}|${limit}|`) ? result : null
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    loading: key !== null && current === null,
    activity: current?.activity ?? null,
    following: current?.following ?? 0,
    error: current?.error ?? null,
    reload,
  }
}
