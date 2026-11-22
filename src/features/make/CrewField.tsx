/**
 * Make / Edit a trail: "Original crew", the friends who were there when you
 * first did it. Shows who's tagged (with "Asked" / "Declined" once saved) and a
 * "Tag friends" button that opens FriendPickerDialog. Optional. On save,
 * MakeTrailForm sends the list with setTrailCrew; each friend then accepts or
 * declines, and accepted crew show on the trail and on their profile.
 */

import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { personName } from '@/features/friends/activityFormat'
import { FriendPickerDialog } from '@/features/friends/FriendPickerDialog'
import { PersonAvatar } from '@/features/friends/FriendsActivity'
import type { CrewPick } from './draft'

const STATUS_NOTE: Record<string, string> = { pending: 'Asked', declined: 'Declined' }

export function CrewField({
  value,
  onChange,
  viewerId,
}: {
  value: CrewPick[]
  onChange: (crew: CrewPick[]) => void
  viewerId: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <p className="mt-0 mb-3 text-sm text-ink-2">
        Did friends do this with you the first time? Tag them as the Original Crew. They’ll be asked to confirm, then it
        shows on the trail and their profile.
      </p>
      {value.length > 0 ? (
        <ul className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
          {value.map(({ person, status }) => (
            <li
              key={person.id}
              className="flex items-center gap-2 rounded-pill border border-line bg-paper py-1 pr-1 pl-1"
            >
              <PersonAvatar person={person} className="size-7" />
              <span className="text-sm font-semibold text-ink">{personName(person)}</span>
              {status && STATUS_NOTE[status] ? (
                <span className="text-xs text-muted-foreground">· {STATUS_NOTE[status]}</span>
              ) : null}
              <button
                type="button"
                className="grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-2 hover:bg-sand"
                aria-label={`Remove ${personName(person)}`}
                onClick={() => onChange(value.filter((c) => c.person.id !== person.id))}
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="btn btn--sm btn--secondary" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        {value.length > 0 ? 'Change who was there' : 'Tag friends'}
      </button>
      <FriendPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        viewerId={viewerId}
        title="Who was there?"
        subtitle="Friends who did this trail with you."
        initial={value.map((c) => c.person.id)}
        allowEmpty
        confirmLabel={(n) => (n === 0 ? 'No one' : n === 1 ? 'Tag 1 friend' : `Tag ${n} friends`)}
        onConfirm={(people) =>
          onChange(people.map((person) => value.find((c) => c.person.id === person.id) ?? { person, status: null }))
        }
      />
    </div>
  )
}
