/**
 * "Friends & privacy" on your own You page:
 * - Private account switch: when on, only friends (people who follow each other)
 *   can see your trails; your profile can still be found and followed.
 * - Close friends: your friends with a star toggle each. Close-friends-only
 *   trails (picked in Make a trail) are visible to starred friends only. Nobody
 *   is told whether they're on your list.
 * Rules are enforced by RLS (migration add_trail_visibility_and_close_friends).
 * Used in the profile Settings panel (ProfileSettingsDialog, `embedded`).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Lock, LoaderCircle, Star } from 'lucide-react'
import type { TrailCreator } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import { getCloseFriendIds, getFriends, setCloseFriend, setPrivateAccount } from './api'

type Props = {
  viewerId: string
  isPrivate: boolean
}

export function PrivacySettings({ viewerId, isPrivate, embedded = false }: Props & { embedded?: boolean }) {
  const [privateOn, setPrivateOn] = useState(isPrivate)
  const [savingPrivate, setSavingPrivate] = useState(false)
  const [friends, setFriends] = useState<TrailCreator[] | null>(null)
  const [close, setClose] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getFriends(viewerId), getCloseFriendIds(viewerId)]).then(
      ([list, ids]) => {
        if (cancelled) return
        setFriends(list)
        setClose(ids)
      },
      () => !cancelled && setFriends([]),
    )
    return () => {
      cancelled = true
    }
  }, [viewerId])

  async function togglePrivate() {
    const next = !privateOn
    setSavingPrivate(true)
    setError(null)
    try {
      await setPrivateAccount(viewerId, next)
      setPrivateOn(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.')
    } finally {
      setSavingPrivate(false)
    }
  }

  async function toggleClose(friendId: string) {
    const on = !close.has(friendId)
    setPending((p) => new Set(p).add(friendId))
    setError(null)
    try {
      await setCloseFriend(viewerId, friendId, on)
      setClose((prev) => {
        const next = new Set(prev)
        if (on) next.add(friendId)
        else next.delete(friendId)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.')
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(friendId)
        return next
      })
    }
  }

  return (
    <section
      aria-labelledby="privacy-title"
      className={embedded ? '' : 'mt-6 rounded-card border border-line bg-white px-4 py-4 md:px-5'}
    >
      <h2 id="privacy-title" className="m-0 text-lg font-bold">
        Friends & privacy
      </h2>
      <p className="mt-1 mb-0 text-sm text-muted-foreground">Friends are people you follow who follow you back.</p>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="m-0 flex items-center gap-1.5 font-semibold text-ink">
            <Lock aria-hidden className="size-4" />
            Private account
          </p>
          <p className="mt-0.5 mb-0 text-sm text-ink-2">Only friends can see your trails. People can still find and follow you.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={privateOn}
          aria-label="Private account"
          onClick={togglePrivate}
          disabled={savingPrivate}
          className={cn(
            'relative h-7 w-12 flex-none cursor-pointer rounded-full transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-wait',
            privateOn ? 'bg-done' : 'bg-line-strong',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
              privateOn && 'translate-x-5',
            )}
          />
        </button>
      </div>

      <h3 className="mt-5 mb-0 text-base font-bold">Close friends</h3>
      <p className="mt-0.5 mb-0 text-sm text-ink-2">
        Star friends to see your close-friends-only trails. Only you can see this list.
      </p>
      {friends === null ? (
        <div aria-hidden className="mt-3 h-12 animate-pulse rounded-[var(--radius-sm)] bg-sand" />
      ) : friends.length === 0 ? (
        <p className="mt-3 mb-0 rounded-[var(--radius-sm)] bg-paper px-3 py-3 text-sm text-muted-foreground">
          No friends yet. When people you follow follow you back, they show up here.
        </p>
      ) : (
        <ul className="m-0 mt-2 list-none p-0">
          {friends.map((friend) => {
            const name = friend.display_name || friend.username || 'Friend'
            const on = close.has(friend.id)
            return (
              <li key={friend.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                {friend.avatar_url ? (
                  <img src={friend.avatar_url} alt="" referrerPolicy="no-referrer" className="size-9 flex-none rounded-full object-cover" />
                ) : (
                  <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-crumb-tint font-extrabold text-crumb-strong">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{name}</span>
                  {friend.username ? (
                    <Link to={`/u/${friend.username}`} className="block truncate text-sm text-muted-foreground hover:text-ink">
                      @{friend.username}
                    </Link>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? `Remove ${name} from close friends` : `Add ${name} to close friends`}
                  onClick={() => toggleClose(friend.id)}
                  disabled={pending.has(friend.id)}
                  className={cn('icon-btn', on && 'text-crumb-strong')}
                >
                  {pending.has(friend.id) ? (
                    <LoaderCircle aria-hidden className="animate-spin" />
                  ) : (
                    <Star aria-hidden className={cn(on && 'fill-current')} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error ? (
        <p role="alert" className="mt-3 mb-0 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}
    </section>
  )
}
