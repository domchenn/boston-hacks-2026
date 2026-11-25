/**
 * On Trail detail (task G8): "Remixed from <trail> by @user" when this trail is a
 * remix and the original is still visible, and a Remix button for anyone who
 * didn't make it (opens /make?remix=<id>; logged-out visitors log in first).
 * Renders nothing when neither applies.
 */
import { Shuffle } from 'lucide-react'
import { Link } from 'react-router'
import type { TrailDetail } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'

export function TrailRemixRow({ trail }: { trail: Pick<TrailDetail, 'id' | 'status' | 'creator' | 'remixedFrom'> }) {
  const { session } = useSession()
  const source = trail.remixedFrom
  const isMine = session !== null && session.user.id === trail.creator?.id
  const canRemix = !isMine && trail.status === 'published'
  if (!source && !canRemix) return null

  const by = source?.creator?.username
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {source ? (
        <p className="m-0 inline-flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
          <Shuffle aria-hidden className="size-4 text-crumb-strong" />
          Remixed from{' '}
          <Link to={`/trails/${source.id}`} className="font-semibold text-ink hover:underline">
            {source.title}
          </Link>
          {by ? (
            <>
              {' '}
              by{' '}
              <Link to={`/u/${by}`} className="font-semibold text-crumb-strong hover:text-crumb-deep">
                @{by}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {canRemix ? (
        <Link to={`/make?remix=${trail.id}`} className="btn btn--sm btn--secondary">
          <Shuffle aria-hidden />
          Remix
          <span className="sr-only"> this trail into your own</span>
        </Link>
      ) : null}
    </div>
  )
}
