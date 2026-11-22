/**
 * "6 going" and a small avatar row of who's going, on a scheduled trail's detail
 * page (task G5). Uses getTrailAttendees(), which only returns the count and
 * public profile fields. Re-fetches when `refreshKey` changes (e.g. after you
 * join or leave). Shows nothing if the count can't be loaded.
 */
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { Link } from 'react-router'
import { getTrailAttendees, type Attendee, type TrailAttendees as Attendees } from '@/lib/api/attendees'

const SHOWN = 8

function initials(person: Attendee) {
  const name = person.displayName || person.username || '?'
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  )
}

function Avatar({ person }: { person: Attendee }) {
  const name = person.displayName || person.username || 'Someone'
  const face = person.avatarUrl ? (
    <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-full rounded-full object-cover" />
  ) : (
    <span aria-hidden className="grid size-full place-items-center rounded-full bg-crumb-tint text-xs font-extrabold text-crumb-strong">
      {initials(person)}
    </span>
  )
  const className =
    'block size-9 rounded-full border-2 border-white bg-white focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none'
  return person.username ? (
    <Link to={`/u/${person.username}`} className={className} title={name} aria-label={name}>
      {face}
    </Link>
  ) : (
    <span className={className} title={name} role="img" aria-label={name}>
      {face}
    </span>
  )
}

export function TrailAttendees({
  trailId,
  happened,
  refreshKey,
}: {
  trailId: string
  happened: boolean
  refreshKey?: unknown
}) {
  const [state, setState] = useState<{ key: string; data: Attendees | null } | null>(null)
  const key = `${trailId}|${String(refreshKey)}`

  useEffect(() => {
    let cancelled = false
    getTrailAttendees(trailId, SHOWN).then(
      (data) => !cancelled && setState({ key, data }),
      () => !cancelled && setState({ key, data: null }),
    )
    return () => {
      cancelled = true
    }
  }, [trailId, key])

  // Keep showing the previous numbers while a refresh is in flight.
  const data = state?.data
  if (!data) return null

  const { count, people } = data
  // A trail that already happened with nobody signed up has nothing to show.
  if (happened && count === 0) return null
  const label = happened
    ? `${count} ${count === 1 ? 'person' : 'people'} went`
    : count === 0
      ? 'Nobody’s going yet. Be the first to join.'
      : `${count} going`

  return (
    <section aria-label="Who’s going" className="mt-4 flex flex-wrap items-center gap-3">
      {people.length > 0 ? (
        <ul className="m-0 flex list-none p-0" aria-label="People going">
          {people.map((person, i) => (
            <li key={person.id} className={i === 0 ? '' : '-ml-2.5'}>
              <Avatar person={person} />
            </li>
          ))}
          {count > people.length ? (
            <li className="-ml-2.5">
              <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-sand text-xs font-bold text-ink-2">
                +{count - people.length}
              </span>
            </li>
          ) : null}
        </ul>
      ) : (
        <Users aria-hidden className="size-5 text-scheduled" />
      )}
      <p className="m-0 text-base font-semibold text-scheduled" aria-live="polite">
        {label}
      </p>
    </section>
  )
}
