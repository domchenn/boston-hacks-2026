/**
 * Explore's Trending tab: the trails with the most activity in the last two
 * weeks (finishes, starts, sign-ups, ratings, saves, photos; see the
 * trending_trails() migration), busiest first, each topped with its rank and how
 * many people were on it ("#1 · 6 people in the last 2 weeks"). Uses the same
 * search as For you. Only real counts are shown; with no activity yet it says so
 * instead of padding the list. Renders straight into Explore's card grid.
 * The ranking is loaded by useTrending() (./useTrending) in ExplorePage, so the
 * map shows the same trails.
 */

import type { ReactNode } from 'react'
import { Flame } from 'lucide-react'
import { TrailCard } from '@/components/TrailCard'
import { TRENDING_DAYS } from './api'
import type { TrendingTrail } from './useTrending'

type TrendingPanelProps = {
  /** Ranked trails, or null while the feed or ranking loads. */
  trails: TrendingTrail[] | null
  error: string | null
  onRetry: () => void
  searching: boolean
  hoverId: string | null
  onHover: (id: string | null) => void
}

export function TrendingPanel({ trails, error, onRetry, searching, hoverId, onHover }: TrendingPanelProps) {
  if (error) {
    return (
      <Note title="Couldn't load trending trails">
        <p className="m-0">{error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      </Note>
    )
  }
  if (trails === null) {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[224px] animate-pulse rounded-card border border-line bg-sand" aria-hidden />
        ))}
      </>
    )
  }
  if (trails.length === 0) {
    return (
      <Note title={searching ? 'Nothing trending matches that' : 'Nothing’s trending yet'}>
        <p className="m-0">
          {searching
            ? 'Try another search, or clear it to see everything that’s trending.'
            : 'When people start, finish and rate trails, the busiest ones from the last two weeks show up here.'}
        </p>
      </Note>
    )
  }

  return (
    <>
      <p className="col-span-full m-0 text-sm text-muted-foreground">
        The trails people have been doing most in the last {TRENDING_DAYS / 7} weeks.
      </p>
      {trails.map((trail) => (
        <div
          key={trail.id}
          className="grid content-start gap-2"
          onMouseEnter={() => onHover(trail.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(trail.id)}
          onBlur={() => onHover(null)}
        >
          <p className="m-0 flex items-center gap-1.5 text-sm text-ink-2">
            <Flame aria-hidden className="size-4 text-crumb-strong" />
            <span className="font-bold text-ink">#{trail.rank}</span>
            <span aria-hidden>·</span>
            {trail.people} {trail.people === 1 ? 'person' : 'people'} in the last {TRENDING_DAYS / 7} weeks
          </p>
          <TrailCard trail={trail} selected={hoverId === trail.id} className="h-full" />
        </div>
      ))}
    </>
  )
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="col-span-full rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      <div className="mt-2 text-base text-ink-2">{children}</div>
    </div>
  )
}
