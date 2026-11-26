/**
 * Loads your finished trails and neighborhoods to try, and works out your badges
 * (computeBadges). `reload()` tries again after an error. Used by ProfileBadges.
 */

import { useCallback, useEffect, useState } from 'react'
import { loadFinishedTrails, loadTrailNeighborhoods } from './api'
import { computeBadges, type Badges } from './computeBadges'

type Result = { key: string; badges?: Badges; allNeighborhoods?: string[]; error?: string }

export function useBadges(userId: string) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = `${userId}|${attempt}`

  useEffect(() => {
    let cancelled = false
    const [user] = key.split('|')
    Promise.all([loadFinishedTrails(user), loadTrailNeighborhoods()]).then(
      ([trails, allNeighborhoods]) =>
        !cancelled && setResult({ key, badges: computeBadges(trails), allNeighborhoods }),
      (error: unknown) =>
        !cancelled && setResult({ key, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    )
    return () => {
      cancelled = true
    }
  }, [key])

  const current = result?.key === key ? result : null
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return {
    loading: current === null,
    badges: current?.badges ?? null,
    allNeighborhoods: current?.allNeighborhoods ?? [],
    error: current?.error ?? null,
    reload,
  }
}
