/**
 * Trail detail: the people behind a trail. Keeps three roles apart:
 * - the creator ("Made by"),
 * - the Original Crew, friends who were there the first time (accepted tags,
 *   from getTrailCrew), linked to their profiles,
 * - explorers, everyone who's done it since (counted by ratings, since only
 *   people who finished can rate).
 * Hidden when there's no crew. If the viewer was tagged and hasn't answered, a
 * banner asks "Were you there?" (respondToCrew); crew members can take
 * themselves off.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LoaderCircle } from 'lucide-react'
import { personName } from '@/features/friends/activityFormat'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import { getTrailCrew, leaveCrew, respondToCrew, type CrewMember } from '@/lib/api/crew'
import type { TrailCreator, TrailDetail } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'

function PersonLink({ person }: { person: TrailCreator }) {
  return person.username ? (
    <Link to={`/u/${person.username}`} className="font-semibold text-ink hover:underline">
      {personName(person)}
    </Link>
  ) : (
    <span className="font-semibold text-ink">{personName(person)}</span>
  )
}

export function TrailCrew({ trail }: { trail: TrailDetail }) {
  const { session } = useSession()
  const viewerId = session?.user.id ?? null
  const [crew, setCrew] = useState<{ key: string; list: CrewMember[] } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = `${trail.id}:${viewerId}:${attempt}`

  useEffect(() => {
    let cancelled = false
    getTrailCrew(trail.id).then(
      (list) => !cancelled && setCrew({ key, list }),
      () => !cancelled && setCrew({ key, list: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [trail.id, key])

  const list = crew?.key === key ? crew.list : []
  const accepted = list.filter((c) => c.status === 'accepted')
  const mine = viewerId ? list.find((c) => c.person.id === viewerId) : undefined
  const isCreator = viewerId !== null && trail.creator?.id === viewerId

  async function act(call: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await call()
      setAttempt((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const askMe = mine?.status === 'pending' && !isCreator
  if (accepted.length === 0 && !askMe) return null
  const creatorName = trail.creator ? personName(trail.creator) : 'the creator'

  return (
    <div className="mt-6 grid gap-3">
      {askMe && viewerId ? (
        <div role="note" className="rounded-card border border-crumb bg-crumb-tint px-4 py-3">
          <p className="m-0 text-base text-ink">
            <b>{creatorName}</b> tagged you as part of the <b>Original Crew</b>. Were you there the first time?
          </p>
          <div className="mt-3 flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            <button
              type="button"
              className="btn btn--sm"
              disabled={busy}
              onClick={() => act(() => respondToCrew(trail.id, true))}
            >
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              Yes, I was there
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={busy}
              onClick={() => act(() => respondToCrew(trail.id, false))}
            >
              Not me
            </button>
          </div>
        </div>
      ) : null}

      {accepted.length > 0 ? (
        <section aria-labelledby="trail-crew-title" className="rounded-card border border-line bg-white px-4 py-3">
          <h2 id="trail-crew-title" className="sr-only">
            The people behind this trail
          </h2>
          <dl className="m-0 grid gap-2.5 text-sm text-ink-2">
            {trail.creator && !trail.isCurated ? (
              <div className="flex items-center gap-3">
                <dt className="w-28 flex-none text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Made by
                </dt>
                <dd className="m-0 flex min-w-0 items-center gap-2">
                  <PersonAvatar person={trail.creator} className="size-7" />
                  <PersonLink person={trail.creator} />
                </dd>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <dt className="w-28 flex-none text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Original crew
              </dt>
              <dd className="m-0 flex min-w-0 flex-1 items-center gap-2">
                <span className="flex flex-none -space-x-2">
                  {accepted.slice(0, 4).map((c) => (
                    <PersonAvatar key={c.person.id} person={c.person} className="size-7 ring-2 ring-white" />
                  ))}
                </span>
                <span className="min-w-0">
                  {accepted.map((c, i) => (
                    <span key={c.person.id}>
                      {i > 0 ? ', ' : null}
                      <PersonLink person={c.person} />
                    </span>
                  ))}
                </span>
              </dd>
            </div>
            {trail.rating.count > 0 ? (
              <div className="flex items-center gap-3">
                <dt className="w-28 flex-none text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Explorers
                </dt>
                <dd className="m-0">
                  Rated by {trail.rating.count} {trail.rating.count === 1 ? 'person' : 'people'} who did it
                </dd>
              </div>
            ) : null}
          </dl>
          {mine?.status === 'accepted' && viewerId ? (
            <p className="mt-2.5 mb-0 border-t border-line pt-2.5 text-xs text-muted-foreground">
              You’re on the Original Crew.{' '}
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:text-crumb-deep"
                disabled={busy}
                onClick={() => act(() => leaveCrew(trail.id, viewerId))}
              >
                Take me off
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}
    </div>
  )
}
