/**
 * Explore "Friends" tab (task J7): trails the people you follow made, finished or
 * joined, newest first, each card topped with who did what ("@ben finished · 2 d").
 * Logged out: a nudge to log in. Signed in: a "Find friends" button (FindPeople:
 * opens search + suggestions) is always on top, so you can keep following people; then the
 * activity, or a nudge when there's none. Renders the items of Explore's feed
 * grid. Data: @/features/friends (friends_activity, follows).
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TrailCard } from '@/components/TrailCard'
import type { ActivityItem } from '@/features/friends/api'
import { ACTIVITY_VERBS, handle, timeAgo } from '@/features/friends/activityFormat'
import { FindPeople } from '@/features/friends/FindPeople'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import { useFriendsActivity } from '@/features/friends/useFriendsActivity'
import { loginPath } from '@/features/trail/trailLinks'
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
  const findPeople = <FindPeople viewerId={viewerId} onFollowChange={reload} />
  if (loading) {
    return (
      <>
        {findPeople}
        <Skeleton />
      </>
    )
  }
  if (error) {
    return (
      <>
        {findPeople}
        <PanelMessage title="Couldn't load your friends' trails">
          <p>{error}</p>
          <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={reload}>
            Try again
          </button>
        </PanelMessage>
      </>
    )
  }
  if (!activity || activity.items.length === 0) {
    return (
      <>
        {findPeople}
        <PanelMessage title={following === 0 ? 'Follow people to see their trails' : 'Nothing new from your friends yet'}>
          <p>When the people you follow make, finish or join a trail, it shows up here. Tap <b>Find friends</b> to follow people.</p>
        </PanelMessage>
      </>
    )
  }

  // One card per trail, ordered by its newest activity; items arrive newest first.
  const byTrail = new Map<string, ActivityItem[]>()
  for (const item of activity.items) byTrail.set(item.trailId, [...(byTrail.get(item.trailId) ?? []), item])

  return (
    <>
      {findPeople}
      {[...byTrail].map(([trailId, items]) => (
        <div key={trailId} className="grid content-start gap-2">
          <ActivityLine items={items} />
          <TrailCard trail={activity.trails.get(trailId)!} />
        </div>
      ))}
    </>
  )
}
