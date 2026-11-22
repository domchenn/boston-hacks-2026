/**
 * Explore "Friends" tab (task J7): trails the people you follow made, finished or
 * joined, newest first, each card topped with who did what ("@ben finished · 2 d").
 * Logged out: a nudge to log in. Following no one (or nothing new): a nudge plus
 * "People to follow" (trail makers) with Follow buttons. Renders the items of
 * Explore's feed grid. Data: @/features/friends (friends_activity, follows).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { TrailCard } from '@/components/TrailCard'
import { suggestPeople, type ActivityItem } from '@/features/friends/api'
import { ACTIVITY_VERBS, handle, timeAgo } from '@/features/friends/activityFormat'
import { FollowButton } from '@/features/friends/FollowBar'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import { useFriendsActivity } from '@/features/friends/useFriendsActivity'
import { loginPath } from '@/features/trail/trailLinks'
import type { TrailCreator } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import emptyTrail from '../../../docs/assets/svg/empty-trail.svg'

const ACTIVITY_LIMIT = 60

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden className="h-[224px] animate-pulse rounded-card border border-line bg-sand" />
      ))}
    </>
  )
}

/** Full-width message box, same look as Explore's other empty states. */
function PanelMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="col-span-full rounded-card border border-dashed border-line-strong bg-white px-6 py-10 text-center">
      <img src={emptyTrail} alt="" aria-hidden width={240} height={160} className="mx-auto mb-4 h-auto max-w-full" />
      <p className="text-lg font-bold text-ink">{title}</p>
      {children ? <div className="mt-2 text-base text-ink-2">{children}</div> : null}
    </div>
  )
}

/** A few trail makers you don't follow yet, each with a Follow button. */
function PeopleToFollow({ viewerId, onFollowed }: { viewerId: string; onFollowed: () => void }) {
  const [people, setPeople] = useState<{ viewer: string; list: TrailCreator[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    suggestPeople(viewerId).then(
      (list) => !cancelled && setPeople({ viewer: viewerId, list }),
      () => !cancelled && setPeople({ viewer: viewerId, list: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [viewerId])

  const list = people?.viewer === viewerId ? people.list : null
  if (!list || list.length === 0) return null

  return (
    <div className="mx-auto mt-6 max-w-md text-left">
      <h3 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">People to follow</h3>
      <ul className="m-0 grid list-none gap-2 p-0">
        {list.map((person) => {
          const name = person.display_name || person.username || 'Someone'
          return (
            <li key={person.id} className="flex items-center gap-3 rounded-card border border-line bg-paper px-3 py-2">
              <PersonAvatar person={person} className="size-10" />
              <Link to={`/u/${person.username}`} className="min-w-0 flex-1 truncate hover:underline">
                <span className="block truncate font-semibold text-ink">{name}</span>
                <span className="block truncate text-sm text-muted-foreground">@{person.username}</span>
              </Link>
              <FollowButton viewerId={viewerId} userId={person.id} name={name} initial={false} onChange={onFollowed} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** "@ben finished · 2 d", plus "and 2 others" when more friends did something with the same trail. */
function ActivityLine({ items }: { items: ActivityItem[] }) {
  const [first, ...rest] = items
  const others = new Set(rest.map((i) => i.person.id).filter((id) => id !== first.person.id)).size
  return (
    <p className="m-0 flex min-w-0 items-center gap-2 text-sm text-ink-2">
      <PersonAvatar person={first.person} className="size-6" />
      <span className="min-w-0 truncate">
        {first.person.username ? (
          <Link to={`/u/${first.person.username}`} className="font-semibold text-ink hover:underline">
            {handle(first.person)}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{handle(first.person)}</span>
        )}{' '}
        {ACTIVITY_VERBS[first.kind]}
        {others > 0 ? ` · and ${others} ${others === 1 ? 'other' : 'others'}` : ''}
        <span className="text-muted-foreground">
          {' · '}
          <time dateTime={first.at}>{timeAgo(first.at)}</time>
        </span>
      </span>
    </p>
  )
}

export function FriendsPanel() {
  const { session, loading: sessionLoading } = useSession()
  const viewerId = session?.user.id ?? null
  const { loading, activity, following, error, reload } = useFriendsActivity(viewerId, ACTIVITY_LIMIT)

  if (sessionLoading) return <Skeleton />
  if (!viewerId) {
    return (
      <PanelMessage title="See what your friends are up to">
        <p>Log in to follow people and see the trails they make, finish and join.</p>
        <Link to={loginPath('/')} className="btn btn--sm mt-4">
          Log in
        </Link>
      </PanelMessage>
    )
  }
  if (loading) return <Skeleton />
  if (error) {
    return (
      <PanelMessage title="Couldn't load your friends' trails">
        <p>{error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={reload}>
          Try again
        </button>
      </PanelMessage>
    )
  }
  if (!activity || activity.items.length === 0) {
    return (
      <PanelMessage title={following === 0 ? 'Follow people to see their trails' : 'Nothing new from your friends yet'}>
        <p>When the people you follow make, finish or join a trail, it shows up here.</p>
        <PeopleToFollow viewerId={viewerId} onFollowed={reload} />
      </PanelMessage>
    )
  }

  // One card per trail, ordered by its newest activity; items arrive newest first.
  const byTrail = new Map<string, ActivityItem[]>()
  for (const item of activity.items) byTrail.set(item.trailId, [...(byTrail.get(item.trailId) ?? []), item])

  return (
    <>
      {[...byTrail].map(([trailId, items]) => (
        <div key={trailId} className="grid content-start gap-2">
          <ActivityLine items={items} />
          <TrailCard trail={activity.trails.get(trailId)!} />
        </div>
      ))}
    </>
  )
}
