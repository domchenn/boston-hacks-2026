/**
 * "Asked you along": open invites from friends to join their outing of a trail
 * (getMyOutingInvites), shown at the top of Explore → Friends. Join accepts and
 * opens the trail's Active trail page, where you share their checklist; No thanks
 * declines. Hidden when there are none.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { LoaderCircle, Users } from 'lucide-react'
import { getMyOutingInvites, respondToOuting, type OutingInvite } from '@/lib/api/outings'
import { PersonAvatar } from './FriendsActivity'
import { timeAgo } from './activityFormat'

export function OutingInvites({ viewerId }: { viewerId: string }) {
  const navigate = useNavigate()
  const [invites, setInvites] = useState<{ viewerId: string; list: OutingInvite[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyOutingInvites().then(
      (list) => !cancelled && setInvites({ viewerId, list }),
      () => !cancelled && setInvites({ viewerId, list: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [viewerId])

  const list = invites?.viewerId === viewerId ? invites.list : []
  if (list.length === 0) return null

  async function respond(invite: OutingInvite, accept: boolean) {
    setBusy(invite.outingId)
    setError(null)
    try {
      await respondToOuting(invite.outingId, accept)
      if (accept) return navigate(`/trails/${invite.trailId}/go`)
      setInvites((prev) => prev && { ...prev, list: prev.list.filter((i) => i.outingId !== invite.outingId) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="outing-invites-title" className="col-span-full">
      <h2 id="outing-invites-title" className="m-0 flex items-center gap-1.5 text-base font-bold text-ink">
        <Users aria-hidden className="size-4 text-crumb-strong" />
        Asked you along
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
        Friends doing a trail right now. Join to share their checklist.
      </p>
      {error ? (
        <p role="alert" className="mt-0 mb-2 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}
      <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
        {list.map((invite) => {
          const from = invite.from
          const name = from ? from.display_name || (from.username ? `@${from.username}` : 'A friend') : 'A friend'
          return (
            <li
              key={invite.outingId}
              className="flex flex-wrap items-center gap-3 rounded-card border border-crumb bg-crumb-tint px-4 py-3"
            >
              {from ? <PersonAvatar person={from} className="size-9 ring-2 ring-white" /> : null}
              <p className="m-0 min-w-0 flex-1 text-sm text-ink-2">
                <b className="text-ink">{name}</b> is doing{' '}
                <Link
                  to={`/trails/${invite.trailId}`}
                  className="font-semibold text-ink underline-offset-2 hover:underline"
                >
                  {invite.trailTitle}
                </Link>
                <span className="text-muted-foreground"> · {timeAgo(invite.invitedAt)}</span>
              </p>
              <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={busy !== null}
                  onClick={() => respond(invite, true)}
                >
                  {busy === invite.outingId ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
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
            </li>
          )
        })}
      </ul>
    </section>
  )
}
