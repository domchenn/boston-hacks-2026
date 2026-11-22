/**
 * Pick friends from a list: a native <dialog> (bottom sheet on phones) of your
 * friends (mutual follows, getFriends) with a checkbox on each. Used to invite
 * friends to an outing (Active trail) and to tag the Original Crew (Make a trail).
 * `locked` people show as already chosen and can't be changed; `initial` starts
 * them ticked but changeable. onConfirm gets the picked people.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle, X } from 'lucide-react'
import type { TrailCreator } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import { getFriends } from './api'
import { personName } from './activityFormat'
import { PersonAvatar } from './FriendsActivity'

type Props = {
  open: boolean
  onClose: () => void
  viewerId: string
  title: string
  subtitle?: string
  /** Already chosen and fixed (e.g. already on the outing), with a note under the name. */
  locked?: Set<string>
  lockedNote?: string
  /** Ticked when the dialog opens. */
  initial?: string[]
  /** Button text for how many are picked. */
  confirmLabel: (count: number) => string
  /** Lets the button confirm an empty pick (e.g. clearing a list). */
  allowEmpty?: boolean
  onConfirm: (people: TrailCreator[]) => Promise<void> | void
}

export function FriendPickerDialog(props: Props) {
  const { open, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="friend-picker-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={cn(
        'm-auto w-[min(100%-2rem,440px)] overflow-hidden rounded-card border border-line bg-white p-0 text-ink shadow-[var(--shadow-float)]',
        'backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        'open:animate-in open:fade-in open:zoom-in-95 max-sm:open:slide-in-from-bottom-8 open:duration-200 motion-reduce:open:animate-none',
      )}
    >
      {/* Mounted while open, so each opening starts from `initial`. */}
      {open ? <PickerBody {...props} /> : null}
    </dialog>
  )
}

function PickerBody({
  onClose,
  viewerId,
  title,
  subtitle,
  locked,
  lockedNote,
  initial,
  confirmLabel,
  allowEmpty = false,
  onConfirm,
}: Props) {
  const [friends, setFriends] = useState<TrailCreator[] | 'error' | null>(null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial ?? []))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getFriends(viewerId).then(
      (list) => !cancelled && setFriends(list),
      () => !cancelled && setFriends('error'),
    )
    return () => {
      cancelled = true
    }
  }, [viewerId])

  async function confirm() {
    if (!Array.isArray(friends)) return
    setSending(true)
    setError(null)
    try {
      await onConfirm(friends.filter((f) => picked.has(f.id)))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
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
    <div className="flex max-h-[min(75dvh,600px)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="friend-picker-title" className="m-0 text-base font-bold">
            {title}
          </h2>
          {subtitle ? <p className="m-0 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
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
              const fixed = locked?.has(person.id) ?? false
              const checked = fixed || picked.has(person.id)
              return (
                <li key={person.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={fixed}
                    onClick={() => toggle(person.id)}
                    className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent py-2.5 text-left disabled:cursor-default"
                  >
                    <PersonAvatar person={person} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-ink">{personName(person)}</span>
                      {fixed && lockedNote ? (
                        <span className="block text-xs text-muted-foreground">{lockedNote}</span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-6 flex-none place-items-center rounded-full',
                        checked ? 'bg-crumb-strong text-white' : 'border-2 border-line-strong',
                        fixed && 'opacity-50',
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
        <button
          type="button"
          className="btn btn--block"
          disabled={(!allowEmpty && picked.size === 0) || sending || !Array.isArray(friends)}
          onClick={confirm}
        >
          {sending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {confirmLabel(picked.size)}
        </button>
      </div>
    </div>
  )
}
