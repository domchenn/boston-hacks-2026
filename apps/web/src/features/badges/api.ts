/**
 * Data for the You page badges (task J8): your finished trails with their T line
 * and neighborhood. Progress is private (RLS: only you can read your
 * user_sidequests rows), so badges only show on your own page. Also suggests
 * neighborhoods to try next from those with published trails. Used by useBadges.
 */

import { loadNeighborhoods } from '@/features/explore/api'
import { supabase } from '@/lib/supabase'
import type { TransitLine } from '@/types/db-values'
import type { FinishedTrail } from './computeBadges'

const LINES: readonly string[] = ['rl', 'ol', 'gl', 'bl', 'sl', 'cr'] satisfies TransitLine[]

/** All your finished trails. One whose maker has since hidden it still counts, without line or neighborhood. */
export async function loadFinishedTrails(userId: string): Promise<FinishedTrail[]> {
  const { data, error } = await supabase
    .from('user_sidequests')
    .select('completed_at, sidequest:sidequests(primary_line, neighborhood)')
    .eq('user_id', userId)
    .eq('status', 'completed')
  if (error) throw new Error(error.code ? 'Couldn’t load your badges.' : 'We couldn’t reach Breadcrumb. Check your connection.')
  return data.flatMap((row) => {
    if (!row.completed_at) return []
    const line = row.sidequest?.primary_line ?? null
    return [
      {
        completedAt: row.completed_at,
        line: line && LINES.includes(line) ? (line as TransitLine) : null,
        neighborhood: row.sidequest?.neighborhood ?? null,
      },
    ]
  })
}

/** Neighborhoods with published trails, for "try next" chips. A nice-to-have, so failures give []. */
export async function loadTrailNeighborhoods(): Promise<string[]> {
  try {
    return await loadNeighborhoods()
  } catch {
    return []
  }
}
