/**
 * Trail detail, under the actions: open invites to join a friend's outing of
 * this trail ("Maya asked you to do this together" · Join / No thanks), then
 * "Your outings": each time you did this trail, newest first, with who you went
 * with and whether it finished, so doing a trail again adds to your history
 * instead of replacing it. Hidden when there's nothing to show.
 * State comes from useTrailActions (getMyOutings, getMyOutingInvites).
 */

import { Link } from 'react-router'
import { Check, LoaderCircle, Users } from 'lucide-react'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import type { Outing } from '@/lib/api/outings'
import type { TrailCreator } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import type { TrailActionsState } from './useTrailActions'

const nameOf = (p: TrailCreator) => p.display_name || (p.username ? `@${p.username}` : 'A friend')

const DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function TrailOutings({ trailId, actions }: { trailId: string; actions: TrailActionsState }) {
  const { session } = useSession()
  const viewerId = session?.user.id ?? null
  const { invites, outings, busy, respond } = actions
  const history = outings.filter((o) => o.status !== 'ended' || o.members.length > 1)
  if (!viewerId || (invites.length === 0 && history.length === 0)) return null

  return (
    <div className="mt-6 grid gap-3">
      {invites.map((invite) => (
        <div
          key={invite.outingId}
          role="note"
          className="flex flex-wrap items-center gap-3 rounded-card border border-crumb bg-crumb-tint px-4 py-3"
        >
          {invite.from ? (
            <PersonAvatar person={invite.from} className="size-9 ring-2 ring-white" />
          ) : (
            <Users aria-hidden className="size-5" />
          )}
          <p className="m-0 min-w-0 flex-1 text-base text-ink">
            <b>{invite.from ? nameOf(invite.from) : 'A friend'}</b> asked you to do this trail together. You’ll share
            one checklist.
          </p>
          <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            <button
              type="button"
              className="btn btn--sm"
              disabled={busy !== null}
              onClick={() => respond(invite, true)}
            >
              {busy === 'respond' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              Join
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={busy !== null}
              onClick={() => respond(invite, false)}
            >
              No thanks
            </button>
          </div>
        </div>
      ))}

      {history.length > 0 ? (
        <section aria-labelledby="your-outings" className="rounded-card border border-line bg-white px-4 py-3">
          <h2 id="your-outings" className="m-0 text-base font-bold">
            Your outings
          </h2>
          <ul className="m-0 mt-1 list-none p-0">
            {history.slice(0, 6).map((outing) => (
              <OutingRow key={outing.id} outing={outing} viewerId={viewerId} trailId={trailId} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function OutingRow({ outing, viewerId, trailId }: { outing: Outing; viewerId: string; trailId: string }) {
  const friends = outing.members.filter(
    (m) => m.person.id !== viewerId && (m.status === 'joined' || m.status === 'left'),
  )
  const when = DATE.format(new Date(outing.completedAt ?? outing.startedAt))
  const onIt =
    outing.status === 'active' && outing.members.some((m) => m.person.id === viewerId && m.status === 'joined')
  const label =
    outing.status === 'completed'
      ? 'Finished'
      : onIt
        ? 'In progress'
        : outing.status === 'active'
          ? 'You left'
          : 'Stopped'
  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <span
        aria-hidden
        className={
          outing.status === 'completed'
            ? 'grid size-6 flex-none place-items-center rounded-full bg-done text-white'
            : 'size-6 flex-none rounded-full border-[2.5px] border-crumb bg-white'
        }
      >
        {outing.status === 'completed' ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink-2">
        <span className="font-semibold text-ink">{label}</span> ·{' '}
        <time dateTime={outing.completedAt ?? outing.startedAt}>{when}</time>
        {friends.length > 0 ? <> · with {friends.map((m) => nameOf(m.person)).join(', ')}</> : ' · solo'}
      </span>
      {onIt ? (
        <Link to={`/trails/${trailId}/go`} className="text-sm font-semibold text-crumb-strong hover:text-crumb-deep">
          Continue
        </Link>
      ) : friends.length > 0 ? (
        <span className="flex -space-x-2">
          {friends.slice(0, 3).map((m) => (
            <PersonAvatar key={m.person.id} person={m.person} className="size-6 ring-2 ring-white" />
          ))}
        </span>
      ) : null}
    </li>
  )
}
