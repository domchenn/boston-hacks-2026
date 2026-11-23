/**
 * Reusable trail card, kept minimal so the feed is easy to scan; the detail page has
 * the full stop list. Shows: eyebrow (category · neighborhood, or distance on Nearby)
 * with the rating / "In progress" on the right, the title (max 2 lines), where it
 * starts, then cost · time · stops and "@username". The whole card links to /trails/:id.
 * Base styles are .trail-card in docs/styles/components.css; layout tweaks are Tailwind.
 * Used by Explore (feed grid), the Map tab and Saved / You. Takes any object with the
 * fields of TrailCardData, so a FeedTrail from @/lib/api/trails can be passed as-is.
 * `selected` gives the ink edge and lift for the card whose map pin is highlighted.
 */

import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { Link } from 'react-router'
import { categoryLabel, formatCost, formatDistance, formatMinutes } from '@/components/trailFormat'
import { cn } from '@/lib/utils'
import type { Category, TransitLine, UserSidequestStatus } from '@/types/db-values'

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
  /** Explore's Nearby tab: miles from the user to the first stop, shown as "0.4 mi away" (task G7). */
  distanceMiles?: number
  /** Main T line. Not shown on the card (maps use it for pin colors); kept for FeedTrail. */
  primaryLine?: TransitLine | null
  /** The creator's own category name (category 'other'); shown instead of "Other". */
  customCategory?: string | null
  /** Who made it; shown as "@username" in the stats row when there is one. */
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

export function TrailCard({ trail, progress, selected, className }: TrailCardProps) {
  const done = progress === 'completed'
  const eyebrow = [categoryLabel(trail.category, trail.customCategory), done ? 'Finished' : null]
    .filter(Boolean)
    .join(' · ')
  const where = trail.distanceMiles !== undefined ? formatDistance(trail.distanceMiles) : trail.neighborhood

  // Top-right corner: only something worth noticing. Unrated trails show nothing (no "New").
  let corner: ReactNode = null
  if (progress === 'in_progress') corner = <span className="status-link">In progress</span>
  else if (trail.rating.count > 0 && trail.rating.average !== null) {
    corner = (
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
    `${trail.stopCount} ${trail.stopCount === 1 ? 'stop' : 'stops'}`,
  ].filter(Boolean)

  return (
    <Link
      to={`/trails/${trail.id}`}
      className={cn(
        'trail-card flex flex-col',
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
        {corner ? <span className="shrink-0 text-sm font-semibold">{corner}</span> : null}
      </div>

      <h2 className="trail-card__title line-clamp-2">{trail.title}</h2>
      {trail.firstStopName ? (
        <p className="mt-1 mb-0 truncate text-sm text-muted-foreground">Starts at {trail.firstStopName}</p>
      ) : null}

      {/* mt-auto pins this row to the bottom so stats line up across a grid row. */}
      <div className="mt-auto flex items-baseline gap-3 pt-4 text-sm">
        <span className="shrink-0 font-semibold">{stats.join(' · ')}</span>
        {/* Plain text, not a link: the whole card is already a link to the trail. */}
        {trail.creator?.username ? (
          <span className="ml-auto min-w-0 truncate text-muted-foreground">
            <span className="sr-only">Made by </span>@{trail.creator.username}
          </span>
        ) : null}
      </div>
    </Link>
  )
}
