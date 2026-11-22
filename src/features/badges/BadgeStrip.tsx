/**
 * A short row of your earned badges under the profile header (like a trophy
 * shelf): up to three of your newest milestone, current weekly streak, the T
 * line you've explored most and how many neighborhoods, then "See all" to the
 * profile's Badges tab. Computed from your own finished trails (useBadges), so
 * it's only on your own profile. Nothing earned yet: a one-line nudge instead.
 */

import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Flame, Footprints, MapPin, Medal, Trophy } from 'lucide-react'
import { LINE_INFO } from '@/components/trailFormat'
import { T_LINE_COLORS } from '@/lib/transitColors'
import type { TransitLine } from '@/types/db-values'
import { useBadges } from './useBadges'

const MILESTONE_LABEL = { first: 'First trail', five: '5 trails', ten: '10 trails' } as const
const MILESTONE_ICON = { first: Footprints, five: Medal, ten: Trophy } as const

type Chip = { key: string; icon: ReactNode; label: string }

function Pill({ icon, label }: Omit<Chip, 'key'>) {
  return (
    <li className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-crumb-tint px-3 text-sm font-semibold text-ink">
      {icon}
      {label}
    </li>
  )
}

export function BadgeStrip({ userId }: { userId: string }) {
  const { loading, badges } = useBadges(userId)

  if (loading) {
    return (
      <div aria-hidden className="mt-3 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-8 w-28 animate-pulse rounded-pill bg-sand" />
        ))}
      </div>
    )
  }
  if (!badges) return null

  const chips: Chip[] = []
  // Newest milestone first (10 → 5 → first).
  const reached = [...badges.milestones].reverse().find((m) => m.reachedAt)
  if (reached) {
    const Icon = MILESTONE_ICON[reached.id]
    chips.push({ key: 'milestone', icon: <Icon aria-hidden className="size-4 text-crumb-strong" />, label: MILESTONE_LABEL[reached.id] })
  }
  if (badges.streak.current > 0) {
    chips.push({
      key: 'streak',
      icon: <Flame aria-hidden className="size-4 text-crumb-strong" />,
      label: `${badges.streak.current} ${badges.streak.current === 1 ? 'week' : 'weeks'} in a row`,
    })
  }
  const topLine = (Object.entries(badges.lines) as [TransitLine, number][]).sort((a, b) => b[1] - a[1])[0]
  if (topLine) {
    chips.push({
      key: 'line',
      icon: <span aria-hidden className="line-dot" style={{ '--line': T_LINE_COLORS[topLine[0]] } as CSSProperties} />,
      label: LINE_INFO[topLine[0]].name,
    })
  }
  if (badges.neighborhoods.length > 0 && chips.length < 3) {
    const n = badges.neighborhoods.length
    chips.push({ key: 'hoods', icon: <MapPin aria-hidden className="size-4 text-crumb-strong" />, label: `${n} ${n === 1 ? 'neighborhood' : 'neighborhoods'}` })
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.length > 0 ? (
        <ul aria-label="Your badges" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {chips.slice(0, 3).map(({ key, ...chip }) => (
            <Pill key={key} {...chip} />
          ))}
        </ul>
      ) : (
        <span className="text-sm text-muted-foreground">Finish a trail to earn your first badge.</span>
      )}
      <Link
        to={{ search: '?tab=badges' }}
        replace
        className="inline-flex items-center text-sm font-semibold text-crumb-strong hover:text-crumb-deep"
      >
        See all
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </div>
  )
}
