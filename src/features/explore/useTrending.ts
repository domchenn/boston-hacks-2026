/**
 * Trending tab data: useTrending() loads the ranking (loadTrending, totals only)
 * when the tab first opens, and rankTrails() puts the current feed's trails in
 * that order with their rank and people count. Used by ExplorePage, which hands
 * the result to TrendingPanel and the map.
 */

import { useEffect, useState } from 'react'
import { loadTrending, type MapTrail, type TrendingEntry } from './api'

export type TrendingTrail = MapTrail & { rank: number; people: number }

/** The ranking, loaded when the tab first opens. `entries` is null while loading. */
export function useTrending(active: boolean) {
  const [entries, setEntries] = useState<TrendingEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    loadTrending().then(
      (list) => {
        if (cancelled) return
        setEntries(list)
        setError(null)
      },
      () => !cancelled && setError('Couldn’t load what’s trending. Try again.'),
    )
    return () => {
      cancelled = true
    }
  }, [active, attempt])

  return {
    entries,
    error,
    retry: () => {
      setError(null)
      setEntries(null)
      setAttempt((n) => n + 1)
    },
  }
}

/** Feed trails in trending order (only ones in the current feed, i.e. matching the search). */
export function rankTrails(trails: MapTrail[], entries: TrendingEntry[]): TrendingTrail[] {
  const byId = new Map(trails.map((t) => [t.id, t]))
  return entries.flatMap((entry, i) => {
    const trail = byId.get(entry.id)
    return trail ? [{ ...trail, rank: i + 1, people: entry.people }] : []
  })
}
