/**
 * Badges on your own You page (task J8), from your finished trails: first trail,
 * 5 / 10 trails, a weekly streak, Lines explored (finished trails per T line in
 * the line's color from @/lib/transitColors) and Neighborhoods explored (with a
 * few to try next, linking to Explore filtered by that neighborhood, as in
 * docs/mockups/Mobile-Profile.dc.html). Data: useBadges. Shown in the profile's Badges tab (ProfileTrails).
 */

import { useId, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Flame, Footprints, Medal, Trophy, type LucideProps } from 'lucide-react'
import { formatShortDate, LINE_INFO } from '@/components/trailFormat'
import { T_LINE_COLORS } from '@/lib/transitColors'
import { cn } from '@/lib/utils'
import type { TransitLine } from '@/types/db-values'
import type { Badges, Milestone } from './computeBadges'
import { useBadges } from './useBadges'

const LINE_ORDER: TransitLine[] = ['rl', 'ol', 'gl', 'bl', 'sl', 'cr']
const TRY_NEXT = 4

const MILESTONES: Record<Milestone['id'], { label: string; icon: ComponentType<LucideProps> }> = {
  first: { label: 'First trail', icon: Footprints },
  five: { label: '5 trails', icon: Medal },
  ten: { label: '10 trails', icon: Trophy },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function ProfileBadges({ userId }: { userId: string }) {
  const headingId = useId()
  const { loading, badges, allNeighborhoods, error, reload } = useBadges(userId)

  let content
  if (loading) {
    content = (
      <div aria-busy="true" aria-label="Loading badges" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-24 animate-pulse rounded-card bg-sand" />
        ))}
      </div>
    )
  } else if (error || !badges) {
    content = (
      <p role="alert" className="m-0 text-sm text-ink-2">
        {error}{' '}
        <button
          type="button"
          onClick={reload}
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:underline"
        >
          Try again
        </button>
      </p>
    )
  } else {
    content = (
      <>
        <Milestones badges={badges} />
        <LinesExplored lines={badges.lines} />
        <NeighborhoodsExplored explored={badges.neighborhoods} all={allNeighborhoods} />
      </>
    )
  }

  return (
    <section aria-labelledby={headingId} className="mt-2">
      {/* Shown inside the profile's Badges tab, so the heading is for screen readers only. */}
      <h2 id={headingId} className="sr-only">
        Badges
      </h2>
      {content}
    </section>
  )
}

/** First trail, 5 trails, 10 trails and the weekly streak, as four tiles. */
function Milestones({ badges }: { badges: Badges }) {
  const { streak, finished } = badges
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
      {badges.milestones.map(({ id, goal, reachedAt }) => (
        <Tile
          key={id}
          icon={MILESTONES[id].icon}
          title={MILESTONES[id].label}
          earned={reachedAt !== null}
          detail={
            reachedAt ? (
              <time dateTime={reachedAt}>{formatShortDate(reachedAt)}</time>
            ) : goal === 1 ? (
              'Finish any trail'
            ) : (
              `${goal - finished} to go`
            )
          }
        />
      ))}
      <Tile
        icon={Flame}
        title={streak.current > 0 ? `${plural(streak.current, 'week')} in a row` : 'Weekly streak'}
        earned={streak.current > 0}
        detail={
          streak.current === 0
            ? 'Finish a trail this week to start one'
            : streak.thisWeekDone
              ? streak.best > streak.current
                ? `This week done · best ${streak.best}`
                : 'This week done'
              : 'Finish one by Sunday to keep it'
        }
      />
    </ul>
  )
}

function Tile({
  icon: Icon,
  title,
  detail,
  earned,
}: {
  icon: ComponentType<LucideProps>
  title: string
  detail: ReactNode
  earned: boolean
}) {
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-card border px-3 py-3',
        earned ? 'border-transparent bg-crumb-tint' : 'border-dashed border-line-strong',
      )}
    >
      <Icon aria-hidden className={cn('size-6', earned ? 'text-crumb-strong' : 'text-muted-foreground')} />
      <span className={cn('text-sm font-bold', earned ? 'text-ink' : 'text-ink-2')}>
        {title}
        <span className="sr-only">{earned ? ', earned' : ', not yet'}</span>
      </span>
      <span className="text-sm text-ink-2">{detail}</span>
    </li>
  )
}

/** Finished trails per T line, in each line's color; lines you haven't ridden yet are dashed. */
function LinesExplored({ lines }: { lines: Badges['lines'] }) {
  const headingId = useId()
  const explored = LINE_ORDER.filter((line) => lines[line])
  return (
    <div className="mt-5">
      <SubHeading id={headingId} title="Lines explored" note={`${explored.length} of ${LINE_ORDER.length}`} />
      <ul aria-labelledby={headingId} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {LINE_ORDER.map((line) => {
          const count = lines[line] ?? 0
          const color = T_LINE_COLORS[line]
          return (
            <li
              key={line}
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-pill px-3 text-sm font-semibold',
                count ? 'border border-line bg-white text-ink' : 'border border-dashed border-line-strong text-ink-2',
              )}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={count ? { background: color } : { border: `2px solid ${color}` }}
              />
              <span>
                {LINE_INFO[line].name}
                <span className={count ? 'text-ink-2' : 'sr-only'}>
                  {count ? ` · ${plural(count, 'trail')}` : ', not yet'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Neighborhoods you've finished a trail in, plus a few with trails you haven't tried. */
function NeighborhoodsExplored({ explored, all }: { explored: string[]; all: string[] }) {
  const headingId = useId()
  const seen = new Set(explored.map((n) => n.toLowerCase()))
  const tryNext = all.filter((n) => !seen.has(n.toLowerCase())).slice(0, TRY_NEXT)
  if (explored.length === 0 && tryNext.length === 0) return null
  return (
    <div className="mt-5">
      <SubHeading id={headingId} title="Neighborhoods explored" note={`${explored.length}`} />
      <ul aria-labelledby={headingId} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {explored.map((name) => (
          <li
            key={name}
            className="inline-flex h-8 items-center gap-2 rounded-pill bg-[var(--color-green-tint)] px-3 text-sm font-semibold text-done"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-done" />
            {name}
          </li>
        ))}
        {tryNext.map((name) => (
          <li key={name}>
            <Link
              to={`/?neighborhood=${encodeURIComponent(name)}`}
              className="inline-flex h-8 items-center gap-2 rounded-pill border border-dashed border-line-strong px-3 text-sm font-semibold text-ink-2 no-underline hover:border-crumb hover:text-ink"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full border-[1.5px] border-crumb" />
              {name}
              <span className="sr-only">, not yet: see trails here</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SubHeading({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 id={id} className="m-0 text-sm font-bold text-ink">
        {title}
      </h3>
      <span className="text-sm text-muted-foreground">{note}</span>
    </div>
  )
}
