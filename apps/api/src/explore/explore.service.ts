/**
 * Explore reads (M15a), ported from the web's features/explore/api.ts and
 * features/badges/api.ts with the same queries, run as the caller:
 * - trending: the database function trending_trails() (per-trail totals only, never
 *   who; signed-in callers only, which the function's grants also enforce);
 * - neighborhoods: distinct neighborhoods of published trails the caller can see;
 * - finishedTrails: the caller's own completed trails with line and neighborhood,
 *   for badges. A trail hidden from you since still counts, without those two.
 */
import { Injectable } from '@nestjs/common'
import type { FinishedTrail, TransitLine, TrendingEntry, TrendingQuery } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

/** The web's Trending window and list size, used when the query leaves them out. */
const DEFAULT_DAYS = 14
const DEFAULT_LIMIT = 30
const LINES: ReadonlySet<string> = new Set<TransitLine>(['rl', 'ol', 'gl', 'bl', 'sl', 'cr'])

type TrendingRow = { sidequest_id: string; score: number; people: number }
type FinishedRow = { completed_at: string | null; sidequest: { primary_line: string | null; neighborhood: string | null } | null }

@Injectable()
export class ExploreService {
  constructor(private readonly clients: SupabaseClients) {}

  async trending(query: TrendingQuery, user: AuthUser): Promise<TrendingEntry[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .rpc('trending_trails', { p_days: query.days ?? DEFAULT_DAYS, p_limit: query.limit ?? DEFAULT_LIMIT })
    if (error) throw error
    return ((data ?? []) as TrendingRow[]).map((row) => ({ trailId: row.sidequest_id, score: row.score, people: row.people }))
  }

  async neighborhoods(user: AuthUser | null): Promise<string[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('sidequests')
      .select('neighborhood')
      .eq('status', 'published')
      .not('neighborhood', 'is', null)
      .returns<{ neighborhood: string | null }[]>()
    if (error) throw error
    const names = new Set(data.map((row) => row.neighborhood?.trim()).filter((n): n is string => Boolean(n)))
    return [...names].sort((a, b) => a.localeCompare(b))
  }

  async finishedTrails(user: AuthUser): Promise<FinishedTrail[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('user_sidequests')
      .select('completed_at, sidequest:sidequests(primary_line, neighborhood)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .returns<FinishedRow[]>()
    if (error) throw error
    return data.flatMap((row) => {
      if (!row.completed_at) return []
      const line = row.sidequest?.primary_line ?? null
      return [
        {
          completedAt: row.completed_at,
          line: line && LINES.has(line) ? (line as TransitLine) : null,
          neighborhood: row.sidequest?.neighborhood ?? null,
        },
      ]
    })
  }
}
