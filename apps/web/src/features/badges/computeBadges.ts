/**
 * Works out the You page badges (task J8) from your finished trails: first trail,
 * 5 / 10 trails, a weekly streak, finished trails per T line and the
 * neighborhoods you've explored. Pure (no data loading) so it's easy to check.
 * Weeks run Monday to Sunday in Boston time. Used by useBadges / ProfileBadges.
 */

import type { TransitLine } from '@/types/db-values'

/** One finished trail. `line` / `neighborhood` are null if the trail has none (or its maker hid it). */
export type FinishedTrail = {
  completedAt: string
  line: TransitLine | null
  neighborhood: string | null
}

export type Milestone = {
  id: 'first' | 'five' | 'ten'
  /** How many finished trails it takes. */
  goal: number
  /** When you reached it, or null if not yet. */
  reachedAt: string | null
}

export type Streak = {
  /** Weeks in a row with at least one finished trail, ending this week or last week. */
  current: number
  /** Whether this week already counts (otherwise finish one by Sunday to keep it). */
  thisWeekDone: boolean
  best: number
}

export type Badges = {
  finished: number
  milestones: Milestone[]
  streak: Streak
  /** Finished trails per T line (only lines with at least one). */
  lines: Partial<Record<TransitLine, number>>
  /** Neighborhoods you've finished a trail in, A to Z. */
  neighborhoods: string[]
}

export const MILESTONE_GOALS: Record<Milestone['id'], number> = { first: 1, five: 5, ten: 10 }

const bostonDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Monday-based week number of an instant, in Boston time (1970-01-01 was a Thursday). */
export function bostonWeek(date: Date): number {
  const [y, m, d] = bostonDate.format(date).split('-').map(Number)
  const day = Date.UTC(y, m - 1, d) / 86_400_000
  return Math.floor((day + 3) / 7)
}

function streakOf(weeks: Set<number>, now: Date): Streak {
  const thisWeek = bostonWeek(now)
  const thisWeekDone = weeks.has(thisWeek)
  // A streak that ended last week is still alive until this Sunday.
  let current = 0
  for (let w = thisWeekDone ? thisWeek : thisWeek - 1; weeks.has(w); w--) current++

  let best = 0
  let run = 0
  let previous = Number.NaN
  for (const w of [...weeks].sort((a, b) => a - b)) {
    run = w === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = w
  }
  return { current, thisWeekDone, best }
}

export function computeBadges(trails: FinishedTrail[], now = new Date()): Badges {
  const byDate = [...trails].sort((a, b) => a.completedAt.localeCompare(b.completedAt))

  const milestones = (Object.keys(MILESTONE_GOALS) as Milestone['id'][]).map((id) => {
    const goal = MILESTONE_GOALS[id]
    return { id, goal, reachedAt: byDate[goal - 1]?.completedAt ?? null }
  })

  const lines: Partial<Record<TransitLine, number>> = {}
  for (const trail of trails) if (trail.line) lines[trail.line] = (lines[trail.line] ?? 0) + 1

  // "Back Bay" and "back bay " are the same place; keep the first spelling seen.
  const neighborhoods = new Map<string, string>()
  for (const trail of byDate) {
    const name = trail.neighborhood?.trim()
    if (name && !neighborhoods.has(name.toLowerCase())) neighborhoods.set(name.toLowerCase(), name)
  }

  return {
    finished: trails.length,
    milestones,
    streak: streakOf(new Set(trails.map((t) => bostonWeek(new Date(t.completedAt)))), now),
    lines,
    neighborhoods: [...neighborhoods.values()].sort((a, b) => a.localeCompare(b)),
  }
}
