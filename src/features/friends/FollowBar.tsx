/**
 * Following on profiles (task J7):
 * - FollowButton: Follow / Following toggle for one person (follows table; RLS
 *   only lets you follow as yourself). Logged-out visitors get a Follow link to
 *   log in first. Also used by the Explore Friends tab's "People to follow".
 * - FollowBar: "12 followers · 8 following" under a profile's header, plus the
 *   button on other people's profiles. Hooked into ProfilePage (/u/:username, /me).
 */

import { useEffect, useState } from 'react'
import { Check, LoaderCircle, UserPlus } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { loginPath } from '@/features/trail/trailLinks'
import { cn } from '@/lib/utils'
import { follow, getFollowCounts, isFollowing, unfollow } from './api'

type FollowButtonProps = {
  viewerId: string | null
  userId: string
  /** Their name, for the screen-reader label ("Follow Maya"). */
  name: string
  /** Known follow state (skips the lookup), e.g. false for suggestions. */
  initial?: boolean
  /** Called after a follow / unfollow goes through. */
  onChange?: (following: boolean) => void
  className?: string
}

export function FollowButton({ viewerId, userId, name, initial, onChange, className }: FollowButtonProps) {
  const { pathname } = useLocation()
  const lookupKey = viewerId && initial === undefined ? `${viewerId}:${userId}` : null
  const [loaded, setLoaded] = useState<{ key: string; following: boolean } | null>(null)
  const [override, setOverride] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lookupKey) return
    let cancelled = false
    const [viewer, user] = lookupKey.split(':')
    isFollowing(viewer, user).then(
      (following) => !cancelled && setLoaded({ key: lookupKey, following }),
      () => !cancelled && setLoaded({ key: lookupKey, following: false }),
    )
    return () => {
      cancelled = true
    }
  }, [lookupKey])

  if (!viewerId) {
    return (
      <Link to={loginPath(pathname)} className={cn('btn btn--sm', className)} aria-label={`Log in to follow ${name}`}>
        <UserPlus aria-hidden />
        Follow
      </Link>
    )
  }

  const known = override ?? initial ?? (loaded?.key === lookupKey ? loaded.following : null)
  const following = known === true

  async function toggle() {
    if (!viewerId || known === null) return
    setBusy(true)
    setError(null)
    try {
      if (following) await unfollow(viewerId, userId)
      else await follow(viewerId, userId)
      setOverride(!following)
      onChange?.(!following)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-grid justify-items-end gap-1">
      <button
        type="button"
        aria-pressed={following}
        aria-label={following ? `Following ${name}. Tap to unfollow` : `Follow ${name}`}
        disabled={busy || known === null}
        onClick={toggle}
        className={cn('btn btn--sm', following && 'btn--secondary', known === null && 'opacity-60', className)}
      >
        {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : following ? <Check aria-hidden /> : <UserPlus aria-hidden />}
        {following ? 'Following' : 'Follow'}
      </button>
      {error ? (
        <span role="alert" className="text-sm font-medium text-crumb-deep">
          {error}
        </span>
      ) : null}
    </span>
  )
}

type FollowBarProps = {
  profileId: string
  viewerId: string | null
  isOwn: boolean
  name: string
}

export function FollowBar({ profileId, viewerId, isOwn, name }: FollowBarProps) {
  const [counts, setCounts] = useState<{ id: string; followers: number; following: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    // Only decoration: if it fails the counts just don't show.
    getFollowCounts(profileId).then(
      (c) => !cancelled && setCounts({ id: profileId, ...c }),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [profileId])

  const current = counts?.id === profileId ? counts : null

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
        {current ? (
          <>
            <strong className="font-bold text-ink">{current.followers}</strong>
            {current.followers === 1 ? ' follower' : ' followers'}
            <span aria-hidden> · </span>
            <strong className="font-bold text-ink">{current.following}</strong> following
          </>
        ) : (
          <span className="invisible">0 followers · 0 following</span>
        )}
      </p>
      {isOwn ? null : (
        <FollowButton
          viewerId={viewerId}
          userId={profileId}
          name={name}
          onChange={(nowFollowing) =>
            setCounts((c) => (c && c.id === profileId ? { ...c, followers: c.followers + (nowFollowing ? 1 : -1) } : c))
          }
        />
      )}
    </div>
  )
}
