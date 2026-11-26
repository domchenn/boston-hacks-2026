/**
 * Friend overlap on saved trails:
 * - AlsoSavedBy: "Also saved by @joey" (or "@joey and 2 others") with a few
 *   overlapping avatars, under a card. Renders nothing when no friend saved it.
 * - BothSavedSection: Explore → Friends' "You both saved" row: trails you and a
 *   friend both saved, as cards, nudging you to go together.
 * Data: useFriendsAlsoSaved (./alsoSaved), loadCards (./api).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Bookmark } from 'lucide-react'
import { TrailCard, type TrailCardData } from '@/components/TrailCard'
import type { TrailCreator } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import type { AlsoSaved } from './alsoSaved'
import { handle } from './activityFormat'
import { loadCards } from './api'
import { PersonAvatar } from './FriendsActivity'

export function AlsoSavedBy({ friends, className }: { friends: TrailCreator[] | undefined; className?: string }) {
  if (!friends || friends.length === 0) return null
  const [first, ...rest] = friends
  return (
    <p className={cn('m-0 flex min-w-0 items-center gap-2 text-sm text-ink-2', className)}>
      <span aria-hidden className="flex flex-none -space-x-2">
        {friends.slice(0, 3).map((f) => (
          <PersonAvatar key={f.id} person={f} className="size-6 ring-2 ring-white" />
        ))}
      </span>
      <span className="min-w-0 truncate">
        Also saved by{' '}
        {first.username ? (
          <Link to={`/u/${first.username}`} className="font-semibold text-ink hover:underline">
            {handle(first)}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{handle(first)}</span>
        )}
        {rest.length > 0 ? ` and ${rest.length} ${rest.length === 1 ? 'other' : 'others'}` : ''}
      </span>
    </p>
  )
}

/** "You both saved": trails you and friends both saved, newest first (up to 6). */
export function BothSavedSection({ alsoSaved }: { alsoSaved: AlsoSaved | null }) {
  const ids = alsoSaved ? [...alsoSaved.keys()].slice(0, 6) : []
  const idsKey = ids.join(',')
  const [cards, setCards] = useState<{ key: string; map: Map<string, TrailCardData> } | null>(null)

  useEffect(() => {
    if (!idsKey) return
    let cancelled = false
    loadCards(idsKey.split(',')).then(
      (map) => !cancelled && setCards({ key: idsKey, map }),
      () => !cancelled && setCards({ key: idsKey, map: new Map() }),
    )
    return () => {
      cancelled = true
    }
  }, [idsKey])

  const current = cards?.key === idsKey ? cards.map : null
  if (!alsoSaved || ids.length === 0 || !current) return null
  const shown = ids.filter((id) => current.has(id))
  if (shown.length === 0) return null

  return (
    <section aria-labelledby="both-saved-title" className="col-span-full">
      <h2 id="both-saved-title" className="m-0 flex items-center gap-1.5 text-base font-bold text-ink">
        <Bookmark aria-hidden className="size-4 fill-current text-crumb-strong" />
        You both saved
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">Trails you and a friend are both eyeing. Go together?</p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3 p-0 md:gap-4">
        {shown.map((id) => (
          <li key={id} className="grid content-start gap-2">
            <AlsoSavedBy friends={alsoSaved.get(id)} />
            <TrailCard trail={current.get(id)!} />
          </li>
        ))}
      </ul>
    </section>
  )
}
