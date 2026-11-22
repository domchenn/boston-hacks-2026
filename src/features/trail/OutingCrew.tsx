/**
 * Who's on this outing, on Active trail: "Just you" or the friends doing it with
 * you (avatars), anyone invited who hasn't answered yet, and an "Invite friends"
 * button, which opens FriendPickerDialog; picking friends and tapping Invite sends
 * outing invites they can accept from Explore → Friends or the trail page. Friends
 * on the outing share one checklist.
 */

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { personName as nameOf } from '@/features/friends/activityFormat'
import { FriendPickerDialog } from '@/features/friends/FriendPickerDialog'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import type { Outing } from '@/lib/api/outings'

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
      <FriendPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        viewerId={viewerId}
        title="Invite friends"
        subtitle="They’ll share this checklist with you."
        locked={
          new Set(outing.members.filter((m) => m.status === 'joined' || m.status === 'invited').map((m) => m.person.id))
        }
        lockedNote="Already on this outing"
        confirmLabel={(n) => (n > 1 ? `Invite ${n} friends` : 'Invite')}
        onConfirm={async (people) => {
          await onInvite(people.map((p) => p.id))
        }}
      />
    </div>
  )
}
