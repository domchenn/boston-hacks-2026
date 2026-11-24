/**
 * Reusable trail card, kept minimal so the feed is easy to scan. Shows: eyebrow
 * (category · neighborhood, or distance on Nearby) with "@username" on the right, the
 * title (max 2 lines), where it starts, then cost · time, a "N stops" toggle and the
 * rating / "In progress". The toggle opens the path (numbered stop list) in place,
 * collapsed by default; it uses `places` when the caller has them (Explore feed) and
 * otherwise loads the stops with getTrail() on first open. The title link is stretched
 * over the whole card, so clicking anywhere but the toggle opens /trails/:id.
 * Base styles: .trail-card / .stops / .num-ring in docs/styles/components.css.
 * Used by Explore, the Map tab, Saved / You, Friends and the Make preview.
 */

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import { Link } from 'react-router'
import { categoryLabel, formatCost, formatDistance, formatMinutes } from '@/components/trailFormat'
import { getTrail } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import type { Category, TransitLine, UserSidequestStatus } from '@/types/db-values'
import { LuMapPin } from "react-icons/lu";

/** The fields a card needs (a subset of FeedTrail). */
export type TrailCardData = {
  id: string
  title: string
  category: Category | null
  neighborhood: string | null
  estimatedCost: number | null
  estimatedMinutes: number | null
  /** Old dated trails still have this; the app no longer shows dates (trails are go-anytime). */
  scheduledAt?: string | null
  stopCount: number
  firstStopName: string | null
  /** Not shown on the card any more; kept so FeedTrail still fits as-is. */
  lastStopName: string | null
  rating: { average: number | null; count: number }
  /** Every stop in order (getFeed sets this). Without it the path is loaded on first open. */
  places?: { name: string }[]
  /** Explore's Nearby tab: miles from the user to the first stop, shown as "0.4 mi away" (task G7). */
  distanceMiles?: number
  /** Main T line. Not shown on the card (maps use it for pin colors); kept for FeedTrail. */
  primaryLine?: TransitLine | null
  /** The creator's own category name (category 'other'); shown instead of "Other". */
  customCategory?: string | null
  /** Who made it; shown as "@username" top-right when there is one. */
  creator?: { username: string | null } | null
}

type TrailCardProps = {
  trail: TrailCardData
  /** The viewer's own progress on this trail, if any (Saved / You pages). */
  progress?: UserSidequestStatus | null
  /** Highlighted with its pin on the map (hovered, focused or picked). */
  selected?: boolean
  className?: string
}

type PathState = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; names: string[] }

export function TrailCard({ trail, progress, selected, className }: TrailCardProps) {
  const pathId = useId()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState<PathState>({ status: 'idle' })
  const path: PathState = trail.places ? { status: 'ready', names: trail.places.map((p) => p.name) } : loaded

  function togglePath() {
    setOpen((was) => !was)
    if (!trail.places && (loaded.status === 'idle' || loaded.status === 'error')) {
      setLoaded({ status: 'loading' })
      getTrail(trail.id)
        .then((detail) =>
          setLoaded(detail ? { status: 'ready', names: detail.stops.map((s) => s.placeName) } : { status: 'error' }),
        )
        .catch(() => setLoaded({ status: 'error' }))
    }
  }

  const done = progress === 'completed'
  const eyebrow = [categoryLabel(trail.category, trail.customCategory), done ? 'Finished' : null]
    .filter(Boolean)
    .join(' · ')
  const where = trail.distanceMiles !== undefined ? formatDistance(trail.distanceMiles) : trail.neighborhood

  // Bottom-right: only something worth noticing. Unrated trails show nothing (no "New").
  let end: ReactNode = null
  if (progress === 'in_progress') end = <span className="status-link">In progress</span>
  else if (trail.rating.count > 0 && trail.rating.average !== null) {
    end = (
      <span className="rating">
        <Star aria-hidden className="size-4 fill-current" />
        {trail.rating.average.toFixed(1)}
        <span className="sr-only">
          {' '}
          out of 5, {trail.rating.count} {trail.rating.count === 1 ? 'rating' : 'ratings'}
        </span>
      </span>
    )
  }

  const stats = [
    trail.estimatedCost !== null ? formatCost(trail.estimatedCost) : null,
    trail.estimatedMinutes !== null ? formatMinutes(trail.estimatedMinutes) : null,
  ].filter(Boolean)

  return (
    <div
      className={cn(
        'trail-card relative flex flex-col p-5',
        'hover:shadow-[var(--shadow-card),0_10px_28px_color-mix(in_srgb,var(--color-ink)_7%,transparent)]',
        'has-[a:focus-visible]:shadow-[var(--focus-ring)]',
        done && 'trail-card--done',
        selected &&
          'border-ink shadow-[0_0_0_1px_var(--color-ink),0_10px_28px_color-mix(in_srgb,var(--color-ink)_8%,transparent)]',
        className,
      )}
    >
      <div className="trail-card__head">
        <span className="min-w-0 truncate text-sm">
          {eyebrow ? <span className="trail-card__eyebrow">{eyebrow}</span> : null}
          {eyebrow && where ? <span className="text-muted-foreground"> · </span> : null}
          {where ? <span className="text-muted-foreground">{where}</span> : null}
        </span>
        {trail.creator?.username ? (
          <span className="max-w-[45%] shrink-0 truncate text-sm text-muted-foreground">
            <span className="sr-only">Made by </span>@{trail.creator.username}
          </span>
        ) : null}
      </div>

      <h2 className="trail-card__title line-clamp-2 mt-3">
        {/* Stretched link: its ::after covers the card, so the whole card opens the trail. */}
        <Link
          to={`/trails/${trail.id}`}
          className="text-inherit no-underline outline-none after:absolute after:inset-0 after:content-['']"
        >
          {trail.title}
        </Link>
      </h2>
      {trail.firstStopName ? (
        <div className="flex items-center mt-3">
          <LuMapPin className='text-muted-foreground'/>
          <p className="mt-0 mb-0 truncate text-sm text-muted-foreground ml-1">{trail.firstStopName}</p>
        </div>
      ) : null}

      {/* mt-auto pins this row to the bottom so stats line up across a grid row. */}
      <div className="mt-auto flex items-center gap-3 pt-4 text-sm font-semibold">
        {stats.length > 0 ? <span className="shrink-0">{stats.join(' · ')}</span> : null}
        {/* relative z-10 lifts the toggle above the stretched link so it doesn't navigate. */}
        <button
          type="button"
          onClick={togglePath}
          aria-expanded={open}
          aria-controls={pathId}
          className="relative z-10 -my-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
        >
          {trail.stopCount} {trail.stopCount === 1 ? 'stop' : 'stops'}
          <ChevronDown aria-hidden className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
        {end ? <span className="ml-auto shrink-0">{end}</span> : null}
      </div>

      {open ? (
        <div id={pathId} className="mt-3 border-t border-border pt-3 text-sm">
          {path.status === 'ready' ? (
            <ol className="stops m-0" style={{ '--stop-num-size': '22px' } as CSSProperties}>
              {path.names.map((name, i) => (
                <li key={i} className="stop pb-2.5">
                  <span className="num-ring text-xs">{i + 1}</span>
                  <span className="min-w-0 truncate leading-[22px]">{name}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-muted-foreground">
              {path.status === 'error' ? "Couldn't load the stops. Close and reopen to retry." : 'Loading stops…'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
