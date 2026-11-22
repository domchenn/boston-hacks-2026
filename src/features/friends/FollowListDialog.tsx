/**
 * Followers / Following popup, opened by tapping the counts on a profile
 * (FollowBar). A native <dialog> (Esc and the backdrop close it; focus stays
 * inside), centered on desktop and a bottom sheet on phones, fading / sliding in.
 * Two tabs switch between the lists; each person links to their profile and has
 * a Follow / Following button (none on yourself). Follows are public, so anyone
 * can open these lists. Data: getFollowList / getFollowingIds in ./api.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import type { TrailCreator } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import { getFollowingIds, getFollowList, type FollowListKind } from './api'
import { FollowButton } from './FollowBar'
import { PersonAvatar } from './FriendsActivity'

type Props = {
  /** The profile whose lists these are. */
  userId: string
  name: string
  viewerId: string | null
  /** Which list is showing; null = closed. */
  kind: FollowListKind | null
  onKindChange: (kind: FollowListKind) => void
  onClose: () => void
  /** Called when the viewer follows / unfollows someone here (counts may change). */
  onFollowChange?: () => void
}

type Loaded = { key: string; people: TrailCreator[]; followingIds: Set<string> } | { key: string; error: true }

export function FollowListDialog({ userId, name, viewerId, kind, onKindChange, onClose, onFollowChange }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = kind ? `${userId}:${kind}` : null

  // Open / close the native dialog with `kind`.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (kind && !dialog.open) dialog.showModal()
    if (!kind && dialog.open) dialog.close()
  }, [kind])

  useEffect(() => {
    if (!key || !kind) return
    let cancelled = false
    Promise.all([getFollowList(userId, kind), viewerId ? getFollowingIds(viewerId) : Promise.resolve(new Set<string>())]).then(
      ([people, followingIds]) => !cancelled && setLoaded({ key, people, followingIds }),
      () => !cancelled && setLoaded({ key, error: true }),
    )
    return () => {
      cancelled = true
    }
  }, [key, kind, userId, viewerId])

  const current = loaded?.key === key ? loaded : null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="follow-list-title"
      onClose={onClose}
      // Clicking the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        'm-auto w-[min(100%-2rem,440px)] overflow-hidden rounded-card border border-line bg-white p-0 text-ink shadow-[var(--shadow-float)]',
        'backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        'open:animate-in open:fade-in open:zoom-in-95 max-sm:open:slide-in-from-bottom-8 open:duration-200 motion-reduce:open:animate-none',
      )}
    >
      {kind ? (
        <div className="flex max-h-[min(70dvh,560px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="follow-list-title" className="m-0 truncate text-base font-bold">
              {name}
            </h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <X aria-hidden />
            </button>
          </div>
          <div role="tablist" aria-label="Lists" className="flex gap-2 px-4 pt-3">
            {(['followers', 'following'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                className="tab flex-1"
                onClick={() => onKindChange(k)}
              >
                {k === 'followers' ? 'Followers' : 'Following'}
              </button>
            ))}
          </div>

          <div className="min-h-40 overflow-y-auto px-4 pt-2 pb-4">
            {!current ? (
              <div aria-hidden className="mt-2 grid gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-sand" />
                ))}
              </div>
            ) : 'error' in current ? (
              <p role="alert" className="mt-4 text-center text-sm text-crumb-deep">
                Couldn’t load this list. Try again.
              </p>
            ) : current.people.length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </p>
            ) : (
              <ul key={key} className="m-0 list-none p-0 animate-in fade-in duration-200 motion-reduce:animate-none">
                {current.people.map((person) => {
                  const personName = person.display_name || person.username || 'Someone'
                  return (
                    <li key={person.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                      <PersonAvatar person={person} className="size-10" />
                      {person.username ? (
                        <Link to={`/u/${person.username}`} onClick={onClose} className="min-w-0 flex-1 hover:underline">
                          <span className="block truncate font-semibold text-ink">{personName}</span>
                          <span className="block truncate text-sm text-muted-foreground">@{person.username}</span>
                        </Link>
                      ) : (
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{personName}</span>
                      )}
                      {viewerId && person.id !== viewerId ? (
                        <FollowButton
                          viewerId={viewerId}
                          userId={person.id}
                          name={personName}
                          initial={current.followingIds.has(person.id)}
                          onChange={onFollowChange}
                        />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
