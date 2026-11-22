/**
 * Who's on this outing, on Active trail: "Just you" or the friends doing it with
 * you (avatars), anyone invited who hasn't answered yet, and an "Invite friends"
 * button. The button opens a native <dialog> (bottom sheet on phones) listing your
 * friends (mutual follows, getFriends); picking some and tapping Invite sends
 * outing invites they can accept from Explore → Friends or the trail page. Friends
 * on the outing share one checklist.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle, UserPlus, X } from 'lucide-react'
import { getFriends } from '@/features/friends/api'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import type { Outing } from '@/lib/api/outings'
import type { TrailCreator } from '@/lib/api/trails'
import { cn } from '@/lib/utils'

const nameOf = (p: TrailCreator) => p.display_name || (p.username ? `@${p.username}` : 'Someone')

type Props = {
  outing: Outing
  viewerId: string
  onInvite: (userIds: string[]) => Promise<number>
  /** No inviting once the outing is finished. */
  finished: boolean
}

export function OutingCrew({ outing, viewerId, onInvite, finished }: Props) {
  const [open, setOpen] = useState(false)
  const joined = outing.members.filter((m) => m.status === 'joined')
  const invited = outing.members.filter((m) => m.status === 'invited')
  const others = joined.filter((m) => m.person.id !== viewerId)

  return (
    <div className="mt-4 flex items-center gap-3 rounded-card border border-line bg-white px-3 py-2.5">
      <div className="flex flex-none -space-x-2">
        {joined.slice(0, 4).map((m) => (
          <PersonAvatar key={m.person.id} person={m.person} className="size-8 ring-2 ring-white" />
        ))}
      </div>
      <p className="m-0 min-w-0 flex-1 text-sm leading-snug text-ink-2">
        {others.length === 0 ? (
          <b className="text-ink">Just you</b>
        ) : (
          <>
            <b className="text-ink">With {others.map((m) => nameOf(m.person)).join(', ')}</b>
            <span className="block text-xs text-muted-foreground">You share one checklist.</span>
          </>
        )}
        {invited.length > 0 ? (
          <span className="block text-xs text-muted-foreground">
            Invited: {invited.map((m) => nameOf(m.person)).join(', ')}
          </span>
        ) : null}
      </p>
      {finished ? null : (
        <button type="button" className="btn btn--sm btn--secondary flex-none" onClick={() => setOpen(true)}>
          <UserPlus aria-hidden />
          Invite
        </button>
      )}
      <InviteFriendsDialog
        open={open}
        onClose={() => setOpen(false)}
        viewerId={viewerId}
        alreadyOn={
          new Set(outing.members.filter((m) => m.status === 'joined' || m.status === 'invited').map((m) => m.person.id))
        }
        onInvite={onInvite}
      />
    </div>
  )
}

type DialogProps = {
  open: boolean
  onClose: () => void
  viewerId: string
  alreadyOn: Set<string>
  onInvite: (userIds: string[]) => Promise<number>
}

function InviteFriendsDialog({ open, onClose, viewerId, alreadyOn, onInvite }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [friends, setFriends] = useState<TrailCreator[] | 'error' | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getFriends(viewerId).then(
      (list) => !cancelled && setFriends(list),
      () => !cancelled && setFriends('error'),
    )
    return () => {
      cancelled = true
    }
  }, [open, viewerId])

  function close() {
    setPicked(new Set())
    setError(null)
    onClose()
  }

  async function send() {
    setSending(true)
    setError(null)
    try {
      await onInvite([...picked])
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t send those invites. Try again.')
    } finally {
      setSending(false)
    }
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="invite-outing-title"
      onClose={close}
      onClick={(event) => event.target === event.currentTarget && close()}
      className={cn(
        'm-auto w-[min(100%-2rem,440px)] overflow-hidden rounded-card border border-line bg-white p-0 text-ink shadow-[var(--shadow-float)]',
        'backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        'open:animate-in open:fade-in open:zoom-in-95 max-sm:open:slide-in-from-bottom-8 open:duration-200 motion-reduce:open:animate-none',
      )}
    >
      {open ? (
        <div className="flex max-h-[min(75dvh,600px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 id="invite-outing-title" className="m-0 text-base font-bold">
                Invite friends
              </h2>
              <p className="m-0 text-xs text-muted-foreground">They’ll share this checklist with you.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
              <X aria-hidden />
            </button>
          </div>

          <div className="min-h-32 overflow-y-auto px-4 py-2">
            {friends === null ? (
              <div aria-hidden className="grid gap-2 py-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-[var(--radius-sm)] bg-sand" />
                ))}
              </div>
            ) : friends === 'error' ? (
              <p role="alert" className="my-6 text-center text-sm text-crumb-deep">
                Couldn’t load your friends. Try again.
              </p>
            ) : friends.length === 0 ? (
              <p className="my-6 text-center text-sm text-muted-foreground">
                No friends yet. Friends are people you follow who follow you back.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {friends.map((person) => {
                  const on = alreadyOn.has(person.id)
                  const checked = on || picked.has(person.id)
                  return (
                    <li key={person.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        disabled={on}
                        onClick={() => toggle(person.id)}
                        className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-2.5 text-left disabled:cursor-default"
                      >
                        <PersonAvatar person={person} className="size-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold text-ink">{nameOf(person)}</span>
                          {on ? (
                            <span className="block text-xs text-muted-foreground">Already on this outing</span>
                          ) : null}
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            'grid size-6 flex-none place-items-center rounded-full',
                            checked ? 'bg-crumb-strong text-white' : 'border-2 border-line-strong',
                            on && 'opacity-50',
                          )}
                        >
                          {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            {error ? (
              <p role="alert" className="mt-0 mb-2 text-sm text-crumb-deep">
                {error}
              </p>
            ) : null}
            <button type="button" className="btn btn--block" disabled={picked.size === 0 || sending} onClick={send}>
              {sending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              {picked.size > 1 ? `Invite ${picked.size} friends` : 'Invite'}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
