/**
 * "Add a place" search box for Make a trail. As you type it shows matching places
 * from the curated library, then Google results (./googlePlaces: any real place,
 * with its address and location), and offers to add what you typed as your own
 * place. Typing coordinates ("42.3554, -71.0765") offers a dropped pin there. An Add button next to the box picks the highlighted
 * option, so Enter isn't the only way in. Keyboard: ↑/↓ to move, Enter to pick,
 * Esc to close. `inputRef` lets the page focus the box ("+ Add another stop").
 */

import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react'
import { Crosshair, Globe, LoaderCircle, MapPin, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Place } from './api'
import { parseCoordinates, placeDetails, searchPlaces, type FoundPlace, type PlaceSuggestion } from './googlePlaces'

type PlacePickerProps = {
  places: Place[]
  /** Library places already on the trail, so they aren't offered twice. */
  usedPlaceIds: Set<string>
  onPickPlace: (place: Place) => void
  onAddCustom: (name: string) => void
  /** A place found through Google search, with its address and location. */
  onAddFound: (place: FoundPlace) => void
  /** A dropped pin at typed coordinates. */
  onAddPin: (latitude: number, longitude: number) => void
  disabled?: boolean
  /** The search input, so the page can focus it. */
  inputRef?: Ref<HTMLInputElement>
}

type Option =
  | { kind: 'place'; place: Place }
  | { kind: 'google'; suggestion: PlaceSuggestion }
  | { kind: 'pin'; latitude: number; longitude: number }
  | { kind: 'custom'; name: string }

/** Wait this long after the last keystroke before asking Google. */
const SEARCH_DELAY_MS = 250

export function PlacePicker({
  places,
  usedPlaceIds,
  onPickPlace,
  onAddCustom,
  onAddFound,
  onAddPin,
  disabled,
  inputRef,
}: PlacePickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const [google, setGoogle] = useState<{ query: string; list: PlaceSuggestion[] } | null>(null)
  const [picking, setPicking] = useState(false)
  const pin = parseCoordinates(query)
  const trimmed = query.trim()

  // Ask Google once typing pauses (not for coordinates or very short text).
  useEffect(() => {
    if (trimmed.length < 3 || pin) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchPlaces(trimmed).then((list) => !cancelled && setGoogle({ query: trimmed, list }))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, pin])
  // Closing on blur waits a moment (so a click on an option still lands). If the
  // box gets focus back meanwhile (e.g. "+ Add another stop"), that close is cancelled.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase()
    const matches = places
      .filter((p) => !usedPlaceIds.has(p.id))
      .filter((p) => !q || [p.name, p.neighborhood, p.address].some((v) => v?.toLowerCase().includes(q)))
      .slice(0, 6)
      .map<Option>((place) => ({ kind: 'place', place }))
    if (!q) return matches
    if (pin) return [...matches, { kind: 'pin', ...pin }]
    // Google results for exactly this text, minus places the library already listed.
    const libraryNames = new Set(matches.map((m) => (m.kind === 'place' ? m.place.name.toLowerCase() : '')))
    const found = (google?.query === query.trim() ? google.list : [])
      .filter((s) => !libraryNames.has(s.name.toLowerCase()))
      .map<Option>((suggestion) => ({ kind: 'google', suggestion }))
    const exact = places.some((p) => p.name.toLowerCase() === q)
    return exact ? [...matches.slice(0, 4), ...found] : [...matches.slice(0, 4), ...found, { kind: 'custom', name: query.trim() }]
  }, [places, usedPlaceIds, query, google, pin])

  function reset() {
    setQuery('')
    setOpen(false)
    setActive(0)
  }

  async function choose(option: Option) {
    if (option.kind === 'place') onPickPlace(option.place)
    else if (option.kind === 'pin') onAddPin(option.latitude, option.longitude)
    else if (option.kind === 'custom') onAddCustom(option.name)
    else {
      // Fetch the address and location; if Google fails, keep the name as your own place.
      setPicking(true)
      const found = await placeDetails(option.suggestion)
      setPicking(false)
      if (found) onAddFound(found)
      else onAddCustom(option.suggestion.name)
    }
    reset()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && open && options[active] && !picking) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && !disabled && options.length > 0

  return (
    <div className="relative">
      <label className="flex h-11 items-center gap-2 rounded-pill border border-line-strong bg-white px-4 focus-within:shadow-[var(--focus-ring)]">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Add a place</span>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          value={query}
          disabled={disabled}
          placeholder={disabled ? 'That’s the maximum number of stops' : 'Search a place, or type a name to add your own'}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => {
            cancelClose()
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            cancelClose()
            closeTimer.current = setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {query.trim() && !disabled && options[active] ? (
          <button
            type="button"
            className="btn btn--sm -mr-2.5 h-8 shrink-0 px-3"
            disabled={picking}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(options[active])}
          >
            {picking ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
            Add
            <span className="sr-only"> {optionLabel(options[active])}</span>
          </button>
        ) : null}
      </label>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-card border border-line bg-white py-1 shadow-[var(--shadow-float)]"
        >
          {options.map((option, i) => (
            <li
              key={optionKey(option)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-start gap-3 px-4 py-2.5', i === active && 'bg-paper')}
            >
              {option.kind === 'place' ? (
                <>
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-crumb-strong" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{option.place.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[option.place.address, option.place.nearest_station].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </>
              ) : option.kind === 'google' ? (
                <>
                  <Globe aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-2" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{option.suggestion.name}</span>
                    {option.suggestion.detail ? (
                      <span className="block truncate text-sm text-muted-foreground">{option.suggestion.detail}</span>
                    ) : null}
                  </span>
                </>
              ) : option.kind === 'pin' ? (
                <>
                  <Crosshair aria-hidden className="mt-0.5 size-4 shrink-0 text-crumb-strong" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">Drop a pin here</span>
                    <span className="block text-sm text-muted-foreground">
                      {option.latitude}, {option.longitude} · name it after
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-crumb-strong" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">Add “{option.name}”</span>
                    <span className="block text-sm text-muted-foreground">As your own place (add the address after)</span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function optionKey(option: Option) {
  if (option.kind === 'place') return option.place.id
  if (option.kind === 'google') return `g:${option.suggestion.prediction.placeId}`
  return option.kind
}

/** What the Add button adds, for screen readers. */
function optionLabel(option: Option) {
  if (option.kind === 'place') return option.place.name
  if (option.kind === 'google') return option.suggestion.name
  if (option.kind === 'pin') return `a pin at ${option.latitude}, ${option.longitude}`
  return `“${option.name}” as your own place`
}
