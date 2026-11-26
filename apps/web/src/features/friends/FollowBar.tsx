/**
 * Following on profiles (task J7):
 * - FollowButton: Follow / Following toggle for one person (follows table; RLS
 *   only lets you follow as yourself). Logged-out visitors get a Follow link to
 *   log in first. Also used by the Explore Friends tab's "People to follow".
 * - FollowBar: "12 followers · 8 following" under a profile's header, plus the
 *   button on other people's profiles, a "Friends" label when you follow each
 *   other (or "Follows you" + "Follow back"). Tapping a count opens the
 *   Followers / Following popup (FollowListDialog). Hooked into ProfilePage (/u/:username, /me).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Check, LoaderCircle, UserPlus, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { loginPath } from '@/features/trail/trailLinks'
import { cn } from '@/lib/utils'
import { follow, getFollowCounts, getRelationship, isFollowing, unfollow, type FollowListKind, type Relationship } from './api'
import { FollowListDialog } from './FollowListDialog'

type FollowButtonProps = {
  viewerId: string | null
  userId: string
  /** Their name, for the screen-reader label ("Follow Maya"). */
  name: string
  /** Known follow state (skips the lookup), e.g. false for suggestions. */
  initial?: boolean
  /** They already follow you: the button says "Follow back". */
  followsYou?: boolean
  /** Called after a follow / unfollow goes through. */
  onChange?: (following: boolean) => void
  className?: string
}

export function FollowButton({ viewerId, userId, name, initial, followsYou, onChange, className }: FollowButtonProps) {
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
        {following ? 'Following' : followsYou ? 'Follow back' : 'Follow'}
      </button>
      {error ? (
        <span role="alert" className="text-sm font-medium text-crumb-deep">
          {error}
        </span>
      ) : null}
    </span>
  )
}

const countButton =
  'cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent p-0 text-inherit hover:underline focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none'

type FollowBarProps = {
  profileId: string
  viewerId: string | null
  isOwn: boolean
  name: string
  /** Called after following / unfollowing (a private profile may now show trails). */
  onRelationshipChange?: () => void
  /** More stats shown after the counts, e.g. "· 1 finished · 2 made". */
  extra?: ReactNode
}

export function FollowBar({ profileId, viewerId, isOwn, name, onRelationshipChange, extra }: FollowBarProps) {
  const [counts, setCounts] = useState<{ id: string; followers: number; following: number } | null>(null)
  const [countsVersion, setCountsVersion] = useState(0)
  const [listKind, setListKind] = useState<FollowListKind | null>(null)

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
  }, [profileId, countsVersion])

  const current = counts?.id === profileId ? counts : null

  // Friends = you follow each other. Looked up once per profile.
  const relKey = viewerId && !isOwn ? `${viewerId}:${profileId}` : null
  const [rel, setRel] = useState<(Relationship & { key: string }) | null>(null)
  useEffect(() => {
    if (!relKey) return
    let cancelled = false
    const [viewer, user] = relKey.split(':')
    getRelationship(viewer, user).then(
      (r) => !cancelled && setRel({ key: relKey, ...r }),
      () => !cancelled && setRel({ key: relKey, following: false, followsYou: false }),
    )
    return () => {
      cancelled = true
    }
  }, [relKey])
  const relation = rel?.key === relKey ? rel : null
  const friends = relation?.following && relation.followsYou

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="m-0 text-sm text-muted-foreground" aria-live="polite">
        {current ? (
          <>
            <button type="button" className={countButton} onClick={() => setListKind('followers')} aria-haspopup="dialog">
              <strong className="font-bold text-ink">{current.followers}</strong>
              {current.followers === 1 ? ' follower' : ' followers'}
            </button>
            <span aria-hidden> · </span>
            <button type="button" className={countButton} onClick={() => setListKind('following')} aria-haspopup="dialog">
              <strong className="font-bold text-ink">{current.following}</strong> following
            </button>
            {extra}
          </>
        ) : (
          <span className="invisible">0 followers · 0 following</span>
        )}
      </p>
      {isOwn || (viewerId && !relation) ? null : (
        <span className="flex items-center gap-2">
          {friends ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-[var(--color-green-tint)] px-3 py-1 text-sm font-semibold text-done">
              <Users aria-hidden className="size-4" />
              Friends
            </span>
          ) : relation?.followsYou ? (
            <span className="text-sm font-semibold text-muted-foreground">Follows you</span>
          ) : null}
          <FollowButton
            viewerId={viewerId}
            userId={profileId}
            name={name}
            initial={relation ? relation.following : undefined}
            followsYou={relation?.followsYou}
            onChange={(nowFollowing) => {
              setRel((r) => (r && r.key === relKey ? { ...r, following: nowFollowing } : r))
              setCounts((c) => (c && c.id === profileId ? { ...c, followers: c.followers + (nowFollowing ? 1 : -1) } : c))
              onRelationshipChange?.()
            }}
          />
        </span>
      )}
      <FollowListDialog
        userId={profileId}
        name={name}
        viewerId={viewerId}
        kind={listKind}
        onKindChange={setListKind}
        onClose={() => setListKind(null)}
        // On your own profile, following someone from the list changes your "following" count.
        onFollowChange={isOwn ? () => setCountsVersion((n) => n + 1) : undefined}
      />
    </div>
  )
}
