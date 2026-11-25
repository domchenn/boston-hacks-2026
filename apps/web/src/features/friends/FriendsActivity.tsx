/**
 * "Friends' activity" on your own You page (task J7): the latest things the
 * people you follow made, finished or joined, one line each
 * ("@maya_k finished Sunday Café Hop · 2 d"). Data: useFriendsActivity.
 * Hooked into ProfilePage for /me only.
 */

import { useId } from 'react'
import { Link } from 'react-router'
import type { TrailCreator } from '@/lib/api/trails'
import { ACTIVITY_VERBS, handle, timeAgo } from './activityFormat'
import { useFriendsActivity } from './useFriendsActivity'

const SHOWN = 6

/** Small round photo or initial. */
export function PersonAvatar({ person, className = 'size-8' }: { person: TrailCreator; className?: string }) {
  const name = person.display_name || person.username || '?'
  return person.avatar_url ? (
    <img src={person.avatar_url} alt="" referrerPolicy="no-referrer" className={`${className} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden
      className={`${className} grid shrink-0 place-items-center rounded-full bg-crumb-tint text-sm font-extrabold text-crumb-strong`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * One person's recent activity, for the Activity tab on their profile. Built on
 * friends_activity(), so it only has people you follow (progress is private).
 */
export function PersonActivity({ viewerId, personId, name }: { viewerId: string; personId: string; name: string }) {
  const { loading, activity, error, reload } = useFriendsActivity(viewerId, 100)
  const items = activity?.items.filter((item) => item.person.id === personId) ?? []

  if (loading) {
    return (
      <ul aria-busy="true" aria-label="Loading" className="m-0 grid list-none gap-3 p-0">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-8 animate-pulse rounded-pill bg-sand" />
        ))}
      </ul>
    )
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-ink-2">
        {error}{' '}
        <button type="button" onClick={reload} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:underline">
          Try again
        </button>
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <p className="rounded-card bg-paper px-4 py-6 text-center text-sm text-ink-2">
        No recent activity to show. You see what {name} makes, finishes and joins when you follow them.
      </p>
    )
  }
  return (
    <ul className="m-0 grid list-none gap-3 rounded-card border border-line bg-white p-4">
      {items.map((item) => {
        const trail = activity!.trails.get(item.trailId)!
        return (
          <li key={`${item.kind}-${item.trailId}`} className="text-sm text-ink-2">
            {ACTIVITY_VERBS[item.kind].charAt(0).toUpperCase() + ACTIVITY_VERBS[item.kind].slice(1)}{' '}
            <Link to={`/trails/${trail.id}`} className="font-semibold text-crumb-strong hover:text-crumb-deep">
              {trail.title}
            </Link>
            <span className="text-muted-foreground">
              {' · '}
              <time dateTime={item.at}>{timeAgo(item.at)}</time>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function FriendsActivity({ viewerId }: { viewerId: string }) {
  const headingId = useId()
  const { loading, activity, following, error, reload } = useFriendsActivity(viewerId, SHOWN)

  let content
  if (loading) {
    content = (
      <ul aria-busy="true" aria-label="Loading" className="m-0 grid list-none gap-3 p-0">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-8 animate-pulse rounded-pill bg-sand" />
        ))}
      </ul>
    )
  } else if (error) {
    content = (
      <p role="alert" className="text-sm text-ink-2">
        {error}{' '}
        <button type="button" onClick={reload} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:underline">
          Try again
        </button>
      </p>
    )
  } else if (!activity || activity.items.length === 0) {
    content = (
      <p className="text-sm text-ink-2">
        {following === 0
          ? 'Follow people to see the trails they make, finish and join. Tap a trail maker or reviewer to open their profile.'
          : 'Nothing yet from the people you follow.'}{' '}
        <Link to="/" className="font-semibold text-crumb-strong hover:text-crumb-deep">
          Explore trails
        </Link>
      </p>
    )
  } else {
    content = (
      <ul className="m-0 grid list-none gap-3 p-0">
        {activity.items.map((item) => {
          const trail = activity.trails.get(item.trailId)!
          return (
            <li key={`${item.person.id}-${item.kind}-${item.trailId}`} className="flex items-center gap-2.5 text-sm">
              <PersonAvatar person={item.person} />
              <p className="m-0 min-w-0 flex-1 text-ink-2">
                {item.person.username ? (
                  <Link to={`/u/${item.person.username}`} className="font-semibold text-ink hover:underline">
                    {handle(item.person)}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{handle(item.person)}</span>
                )}{' '}
                {ACTIVITY_VERBS[item.kind]}{' '}
                <Link to={`/trails/${trail.id}`} className="font-semibold text-crumb-strong hover:text-crumb-deep">
                  {trail.title}
                </Link>
                <span className="text-muted-foreground">
                  {' · '}
                  <time dateTime={item.at}>{timeAgo(item.at)}</time>
                </span>
              </p>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-card border border-line bg-white px-4 py-4">
      <h2 id={headingId} className="mb-3 text-base font-bold text-ink">
        Friends&apos; activity
      </h2>
      {content}
    </section>
  )
}
