/**
 * "Find friends" on Explore's Friends tab: an orange button at the top right
 * (always there, so you can keep following people after your first) that opens
 * a panel with a search by name or @username
 * (searchPeople) and, when the box is empty, suggestions (suggestPeopleToFollow: people
 * who follow you first, then trail makers, then recent members). Each person has
 * a Follow / Follow back button and links to their profile. People you just
 * followed stay in the list (showing Following) until the next visit.
 * The panel slides open / closed (grid-rows + fade; instant with reduced motion)
 * and is only created the first time it opens, so suggestions load on demand.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Search, UserPlus, X } from 'lucide-react'
import type { TrailCreator } from '@/lib/api/trails'
import { cn } from '@/lib/utils'
import { searchPeople, suggestPeopleToFollow } from './findPeopleApi'
import { FollowButton } from './FollowBar'
import { PersonAvatar } from './FriendsActivity'

type Props = {
  viewerId: string
  /** Called after a follow / unfollow, so the activity feed can reload. */
  onFollowChange: () => void
}

export function FindPeople({ viewerId, onFollowChange }: Props) {
  const [open, setOpen] = useState(false)
  // Created on first open, then kept so closing can animate.
  const [created, setCreated] = useState(false)
  return (
    <div className="col-span-full">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted-foreground">Trails the people you follow made, finished or joined.</p>
        <button
          type="button"
          className="btn btn--sm shrink-0"
          aria-expanded={open}
          aria-controls="find-people-panel"
          onClick={() => {
            setOpen((v) => !v)
            setCreated(true)
          }}
        >
          <span className={cn('grid transition-transform duration-300 motion-reduce:transition-none', open && 'rotate-90')}>
            {open ? <X aria-hidden /> : <UserPlus aria-hidden />}
          </span>
          {open ? 'Close' : 'Find friends'}
        </button>
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none -translate-y-1 grid-rows-[0fr] opacity-0',
        )}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          {created ? <FindPeoplePanel viewerId={viewerId} open={open} onFollowChange={onFollowChange} /> : null}
        </div>
      </div>
    </div>
  )
}

/** The opened panel: search + suggestions. Loads suggestions when it's first created. */
function FindPeoplePanel({ viewerId, open, onFollowChange }: Props & { open: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Put the cursor in the search box each time the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true })
  }, [open])
  const [query, setQuery] = useState('')
  const [suggested, setSuggested] = useState<TrailCreator[] | null>(null)
  const [results, setResults] = useState<{ q: string; list: TrailCreator[] } | null>(null)
  const [error, setError] = useState(false)
  const q = query.trim()

  useEffect(() => {
    let cancelled = false
    suggestPeopleToFollow(viewerId).then(
      (list) => !cancelled && setSuggested(list),
      () => !cancelled && setSuggested([]),
    )
    return () => {
      cancelled = true
    }
  }, [viewerId])

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q.length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchPeople(viewerId, q).then(
        (list) => {
          if (cancelled) return
          setResults({ q, list })
          setError(false)
        },
        () => !cancelled && setError(true),
      )
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [viewerId, q])

  const searching = q.length >= 2
  const list = searching ? (results?.q === q ? results.list : null) : suggested

  return (
    <section
      id="find-people-panel"
      aria-labelledby="find-people-title"
      className="mt-3 rounded-card border border-line bg-white px-4 py-4 md:px-5"
    >
      <h2 id="find-people-title" className="m-0 text-base font-bold">
        Find friends
      </h2>
      <label className="mt-3 flex h-11 items-center gap-2 rounded-pill border border-line-strong bg-paper px-4 focus-within:shadow-[var(--focus-ring)]">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search people by name or username</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @username"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </label>

      <p className="mt-3 mb-2 text-sm font-semibold text-muted-foreground">
        {searching ? 'Results' : 'People you might know'}
      </p>
      {error && searching ? (
        <p className="m-0 text-sm text-crumb-deep">Couldn’t search right now. Try again.</p>
      ) : list === null ? (
        <div aria-hidden className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-sand" />
      ) : list.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          {searching ? `No one matches “${q}”.` : 'You’re following everyone we know about. Search for someone above.'}
        </p>
      ) : (
        <ul
          key={searching ? `q:${results?.q}` : 'suggested'}
          className="m-0 grid list-none gap-2 p-0 animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-3"
        >
          {list.map((person) => {
            const name = person.display_name || person.username || 'Someone'
            return (
              <li key={person.id} className="flex items-center gap-3 rounded-card border border-line bg-paper px-3 py-2">
                <PersonAvatar person={person} className="size-10" />
                <Link to={`/u/${person.username}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-semibold text-ink">{name}</span>
                  <span className="block truncate text-sm text-muted-foreground">@{person.username}</span>
                </Link>
                {/* Search results may include people you already follow, so let the button look it up. */}
                <FollowButton
                  viewerId={viewerId}
                  userId={person.id}
                  name={name}
                  initial={searching ? undefined : false}
                  onChange={onFollowChange}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
