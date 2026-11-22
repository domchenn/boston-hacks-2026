/**
 * "Tagged you": friends who tagged you as part of the Original Crew of a trail
 * they made (getMyCrewRequests), at the top of Explore → Friends. "I was there"
 * accepts (the trail then shows you on its crew and on your profile); "Not me"
 * declines. Hidden when there are none.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { getMyCrewRequests, respondToCrew, type CrewRequest } from '@/lib/api/crew'
import { personName, timeAgo } from './activityFormat'
import { PersonAvatar } from './FriendsActivity'

export function CrewRequests({ viewerId }: { viewerId: string }) {
  const [requests, setRequests] = useState<{ viewerId: string; list: CrewRequest[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyCrewRequests(viewerId).then(
      (list) => !cancelled && setRequests({ viewerId, list }),
      () => !cancelled && setRequests({ viewerId, list: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [viewerId])

  const list = requests?.viewerId === viewerId ? requests.list : []
  if (list.length === 0 && !done) return null

  async function respond(request: CrewRequest, accept: boolean) {
    setBusy(request.trailId)
    setError(null)
    try {
      await respondToCrew(request.trailId, accept)
      setRequests((prev) => prev && { ...prev, list: prev.list.filter((r) => r.trailId !== request.trailId) })
      setDone(accept ? `You’re on the Original Crew of ${request.trailTitle}.` : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="crew-requests-title" className="col-span-full">
      <h2 id="crew-requests-title" className="m-0 flex items-center gap-1.5 text-base font-bold text-ink">
        <Sparkles aria-hidden className="size-4 text-crumb-strong" />
        Tagged you
      </h2>
      <p className="mt-0.5 mb-3 text-sm text-muted-foreground">
        Friends say you were part of the Original Crew. Confirm and it shows on the trail and your profile.
      </p>
      {done ? (
        <p role="status" className="mt-0 mb-2 text-sm font-semibold text-done">
          {done}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-0 mb-2 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}
      <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
        {list.map((request) => (
          <li
            key={request.trailId}
            className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white px-4 py-3"
          >
            {request.from ? <PersonAvatar person={request.from} className="size-9" /> : null}
            <p className="m-0 min-w-0 flex-1 text-sm text-ink-2">
              <b className="text-ink">{request.from ? personName(request.from) : 'A friend'}</b> tagged you on{' '}
              <Link
                to={`/trails/${request.trailId}`}
                className="font-semibold text-ink underline-offset-2 hover:underline"
              >
                {request.trailTitle}
              </Link>
              <span className="text-muted-foreground"> · {timeAgo(request.taggedAt)}</span>
            </p>
            <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy !== null}
                onClick={() => respond(request, true)}
              >
                {busy === request.trailId ? <LoaderCircle className="animate-spin" aria-hidden /> : null}I was there
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                disabled={busy !== null}
                onClick={() => respond(request, false)}
              >
                Not me
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
