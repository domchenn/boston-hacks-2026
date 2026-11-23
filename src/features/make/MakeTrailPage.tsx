/**
 * Make a trail (docs/mockups/Web-Create + Mobile-Create): basics (name,
 * description, category), 2–8 stops found with Google search, dropped as a pin
 * at coordinates, or added by hand (those can be renamed; stops from the old
 * curated library, on older trails, keep their fixed name), an optional crumb at each stop and how to get there, a live
 * preview card with a route map, and the "Ready to publish" checklist. Save draft / Publish trail
 * call save_trail() through ./api, which saves everything in one transaction.
 * Publish is always tappable: if something is missing it says what, marks the
 * fields and scrolls to the first one. "+ Add another stop" jumps back to the
 * search box.
 * On /make the form is kept on this device as you type (./localDraft), so a
 * refresh doesn't lose it; a note offers "Start over". Cleared on publish.
 * Logged-out users are sent to /login?next=/make.
 * Category: one of the six, or Custom (type your own; saved as category 'other').
 * Basics also has "Who can see it": everyone / friends / close friends.
 * Route: /make · Owner: Dom
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, Circle, Plus, X } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Dropdown } from '@/components/Dropdown'
import { RouteMap } from '@/components/RouteMap'
import { TrailCard } from '@/components/TrailCard'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'
import type { TravelMode } from '@/types/db-values'
import { saveTrail } from './api'
import type { FoundPlace } from './googlePlaces'
import {
  CATEGORY_OPTIONS,
  MAX_CUSTOM_CATEGORY,
  MAX_STOPS,
  TRAVEL_OPTIONS,
  VISIBILITY_OPTIONS,
  canPublish,
  emptyDraft,
  publishChecklist,
  suggestedCost,
  suggestedMinutes,
  type ChecklistKey,
  type StopDraft,
  type TrailDraft,
} from './draft'
import { SHOW_COMMUNITIES } from '@/features/communities/api'
import { VisibilityField } from '@/features/communities/VisibilityField'
import { PlacePicker } from './PlacePicker'
import { RemixTrail } from './RemixTrail'
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from './localDraft'

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 240, 300]

const newKey = () => Math.random().toString(36).slice(2)

function customStop(name: string): StopDraft {
  return {
    key: newKey(),
    experienceId: null,
    placeName: name,
    address: '',
    latitude: null,
    longitude: null,
    neighborhood: null,
    estimatedCost: null,
    travelMode: 'walk',
    crumb: '',
  }
}

/** A place found through Google search: its real address and location, no library link. */
function foundStop(place: FoundPlace): StopDraft {
  return {
    ...customStop(place.name),
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    neighborhood: place.neighborhood,
  }
}

/** A dropped pin at typed coordinates; you name it on the stop. */
function pinStop(latitude: number, longitude: number): StopDraft {
  return { ...customStop(`Pin at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`), latitude, longitude }
}

function formatMinutes(minutes: number) {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`
}

/** What to tell people when they tap Publish with this checklist item missing. */
const MISSING_TEXT: Record<ChecklistKey, string> = {
  basics: 'a name and a category',
  stops: 'at least 2 stops',
}

/** Where to scroll for each missing checklist item. */
const MISSING_TARGET: Record<ChecklistKey, string> = {
  basics: 'trail-basics',
  stops: 'trail-stops',
}

/** White rounded box used for each section of the form. */
function Panel({ id, title, aside, children }: { id?: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card border border-line bg-white p-4 shadow-[var(--shadow-card)] md:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-md font-bold text-ink">{title}</h2>
        {aside ? <span className="text-sm text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  )
}

const fieldClass =
  'w-full rounded-[10px] border border-line-strong bg-white px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted-foreground focus:shadow-[var(--focus-ring)]'
const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-2'

export function MakeTrailPage() {
  const { session, loading } = useSession()
  // /make?remix=<id>: start from someone else's trail (task G8, ./RemixTrail).
  const remixId = useSearchParams()[0].get('remix')
  if (loading) return null
  if (!session) {
    const next = remixId ? `/make?remix=${encodeURIComponent(remixId)}` : '/make'
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  if (remixId) return <RemixTrail key={remixId} trailId={remixId} userId={session.user.id} />
  return <MakeTrailForm autosaveFor={session.user.id} />
}

export type MakeTrailFormProps = {
  /** Start from an existing trail (Edit trail, task G4). Default: an empty draft. */
  initialDraft?: TrailDraft
  /** Set when editing: saves update this trail instead of creating one. */
  trailId?: string | null
  /** Editing a trail that's already live: one "Save changes" button (saving a draft would unpublish it). */
  published?: boolean
  heading?: string
  subheading?: string
  /** Extra panels at the bottom of the sidebar (e.g. Unpublish / Delete on Edit trail). */
  aside?: ReactNode
  /** Keep the form on this device for this user (plain /make only), so a refresh doesn't lose it. */
  autosaveFor?: string
}

export function MakeTrailForm({
  initialDraft,
  trailId: initialTrailId = null,
  published = false,
  heading = 'Make a trail',
  subheading = `Pick 2 to ${MAX_STOPS} stops and publish. Crumbs (small things to do at a stop) are optional.`,
  aside,
  autosaveFor,
}: MakeTrailFormProps = {}) {
  const navigate = useNavigate()
  // Your @username on the preview card, as it will show in the feed.
  const { profile } = useSession()
  // A trail-in-progress kept on this device from before a refresh (plain /make only).
  const [restored] = useState(() => (autosaveFor && !initialDraft ? readLocalDraft(autosaveFor) : null))
  const [showRestored, setShowRestored] = useState(restored !== null)
  const [draft, setDraft] = useState<TrailDraft>(() => restored?.draft ?? initialDraft ?? emptyDraft())
  const [trailId, setTrailId] = useState<string | null>(restored?.trailId ?? initialTrailId)

  // Keep the form on this device as you type.
  useEffect(() => {
    if (autosaveFor) writeLocalDraft(autosaveFor, draft, trailId)
  }, [autosaveFor, draft, trailId])

  function startOver() {
    clearLocalDraft()
    setDraft(emptyDraft())
    setTrailId(null)
    setShowRestored(false)
    setMessage(null)
  }
  // /trails/:id/edit has no phone tab bar, so the action bar sits at the very bottom there.
  const editing = initialTrailId !== null
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  // Set after a Publish tap with something missing: marks the fields that still need work.
  const [showMissing, setShowMissing] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const customCategoryRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<TrailDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setMessage(null)
  }
  const updateStop = (key: string, patch: Partial<StopDraft>) =>
    update({ stops: draft.stops.map((s) => (s.key === key ? { ...s, ...patch } : s)) })
  const removeStop = (key: string) => update({ stops: draft.stops.filter((s) => s.key !== key) })
  const moveStop = (index: number, by: -1 | 1) => {
    const stops = [...draft.stops]
    const [stop] = stops.splice(index, 1)
    stops.splice(index + by, 0, stop)
    update({ stops })
  }
  const addStop = (stop: StopDraft) => {
    if (draft.stops.length >= MAX_STOPS) return
    update({ stops: [...draft.stops, stop] })
  }

  const focusSearch = () => {
    const input = searchRef.current
    if (!input) return
    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Already focused (list maybe closed with Esc)? Refocus so the list opens again.
    if (document.activeElement === input) input.blur()
    input.focus({ preventScroll: true })
  }

  /** Scroll to (and focus, where there's one field) the first thing a checklist item needs. */
  function jumpTo(key: ChecklistKey) {
    const field =
      key === 'basics' && draft.title.trim() === ''
        ? document.getElementById('trail-title')
        : key === 'stops'
          ? searchRef.current
          : null
    const section = document.getElementById(MISSING_TARGET[key])
    ;(field ?? section)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field?.focus({ preventScroll: true })
  }

  function publish() {
    if (canPublish(draft)) return save('published')
    const missing = publishChecklist(draft).filter((item) => !item.done)
    setShowMissing(true)
    setMessage({
      tone: 'error',
      text: `Almost there. Before publishing, add ${missing.map((m) => MISSING_TEXT[m.key]).join(', ')}.`,
    })
    jumpTo(missing[0].key)
  }

  const checklist = publishChecklist(draft)
  const missing = (key: ChecklistKey) => showMissing && !checklist.find((item) => item.key === key)?.done
  const cost = suggestedCost(draft.stops)
  const minutes = draft.durationMinutes ?? suggestedMinutes(draft.stops.length)

  async function save(status: 'draft' | 'published') {
    if (saving) return
    if (draft.title.trim() === '') {
      setMessage({ tone: 'error', text: 'Give your trail a name first.' })
      return
    }
    setSaving(status)
    const result = await saveTrail(draft, status, trailId)
    setSaving(null)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message })
      return
    }
    setTrailId(result.id)
    if (status === 'published') {
      if (autosaveFor) clearLocalDraft()
      navigate(`/trails/${result.id}`)
    }
    else setMessage({ tone: 'ok', text: 'Draft saved. Only you can see it.' })
  }

  const preview = {
    id: trailId ?? 'preview',
    title: draft.title.trim() || 'Your trail name',
    category: draft.category,
    customCategory: draft.customCategory,
    neighborhood: draft.stops[0]?.neighborhood ?? null,
    estimatedCost: cost,
    estimatedMinutes: minutes,
    stopCount: Math.max(draft.stops.length, 2),
    firstStopName: draft.stops[0]?.placeName ?? null,
    lastStopName: draft.stops.length > 1 ? draft.stops[draft.stops.length - 1].placeName : null,
    rating: { average: null, count: 0 },
    creator: profile ? { username: profile.username } : null,
  }

  return (
    <div className="pb-24 md:pb-0">
      {/* Title row with the two actions */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] leading-[var(--leading-tight)] font-extrabold tracking-[var(--tracking-title)] text-ink md:text-[2.5rem]">
            {heading}
          </h1>
          <p className="mt-1.5 text-md text-ink-2">{subheading}</p>
        </div>
        <div
          className={cn(
            'fixed inset-x-0 z-20 flex gap-2 border-t border-line bg-white/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 z-0',
            editing ? 'bottom-0' : 'bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom,0px))]',
          )}
        >
          {published ? null : (
            <button
              type="button"
              className="btn btn--sm btn--secondary flex-1 md:flex-none"
              onClick={() => save('draft')}
              aria-disabled={saving !== null}
            >
              {saving === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
          )}
          <button
            type="button"
            className="btn btn--sm flex-1 md:flex-none"
            onClick={publish}
            aria-disabled={saving !== null}
          >
            {saving === 'published'
              ? published
                ? 'Saving…'
                : 'Publishing…'
              : published
                ? 'Save changes'
                : 'Publish trail'}
          </button>
        </div>
      </div>

      {showRestored && !message ? (
        <p
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-paper px-4 py-3 text-sm text-ink-2"
        >
          <span>We kept the trail you were working on.</span>
          <button
            type="button"
            onClick={startOver}
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:text-crumb-deep hover:underline"
          >
            Start over
          </button>
        </p>
      ) : null}
      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'mb-4 rounded-[10px] px-4 py-3 text-sm font-medium',
            message.tone === 'error' ? 'bg-crumb-tint text-crumb-deep' : 'bg-[var(--color-green-tint)] text-done',
          )}
        >
          {message.text}
        </p>
      ) : null}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4">
          {/* ---------------------------------------------------------- Basics */}
          <Panel id="trail-basics" title="Basics">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="trail-title" className={labelClass}>
                  Name
                </label>
                <input
                  id="trail-title"
                  className={cn(fieldClass, missing('basics') && draft.title.trim() === '' && 'border-crumb-strong')}
                  aria-invalid={missing('basics') && draft.title.trim() === '' ? true : undefined}
                  maxLength={120}
                  placeholder="Rainy Day Bookshop Crawl"
                  value={draft.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="trail-description" className={labelClass}>
                  Short description
                </label>
                <textarea
                  id="trail-description"
                  className={cn(fieldClass, 'min-h-20 resize-y')}
                  maxLength={500}
                  placeholder="Two of Boston's oldest bookshops for a gray afternoon, with a coffee at the end."
                  value={draft.description}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </div>
              <div>
                <fieldset>
                  <legend className={labelClass}>
                    Category
                    {missing('basics') && draft.category === null ? (
                      <span className="ml-2 font-normal text-crumb-deep">Pick one</span>
                    ) : missing('basics') && draft.category === 'other' && draft.customCategory.trim() === '' ? (
                      <span className="ml-2 font-normal text-crumb-deep">Type your category</span>
                    ) : null}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="tab"
                        aria-pressed={draft.category === option.value}
                        aria-selected={draft.category === option.value}
                        onClick={() => {
                          update({ category: option.value })
                          // Custom: jump straight into typing the name.
                          if (option.value === 'other') setTimeout(() => customCategoryRef.current?.focus(), 0)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {draft.category === 'other' ? (
                    <input
                      ref={customCategoryRef}
                      aria-label="Your category"
                      className={cn(
                        'mt-2 h-10 w-full max-w-xs rounded-[10px] border bg-white px-3 text-base outline-none focus:shadow-[var(--focus-ring)]',
                        missing('basics') && draft.customCategory.trim() === '' ? 'border-crumb-strong' : 'border-line-strong',
                      )}
                      placeholder="e.g. Rooftops, Study spots"
                      maxLength={MAX_CUSTOM_CATEGORY}
                      value={draft.customCategory}
                      onChange={(e) => update({ customCategory: e.target.value })}
                    />
                  ) : null}
                </fieldset>
              </div>
              <fieldset>
                <legend className={labelClass}>Who can see it</legend>
                <div className="flex flex-wrap gap-2">
                  {VISIBILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="tab"
                      aria-pressed={draft.visibility === option.value}
                      aria-selected={draft.visibility === option.value}
                      onClick={() => update({ visibility: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {VISIBILITY_OPTIONS.find((o) => o.value === draft.visibility)?.hint}
                </p>
              </fieldset>
              {SHOW_COMMUNITIES ? (
                <VisibilityField
                  value={draft.communityId}
                  onChange={(communityId) => update({ communityId })}
                  labelClass={labelClass}
                />
              ) : null}
            </div>
          </Panel>

          {/* ----------------------------------------------------------- Stops */}
          <Panel id="trail-stops" title="Stops" aside={`${draft.stops.length} of ${MAX_STOPS} · use the arrows to reorder`}>
            <PlacePicker
              inputRef={searchRef}
              disabled={draft.stops.length >= MAX_STOPS}
              onAddCustom={(name) => addStop(customStop(name))}
              onAddFound={(place) => addStop(foundStop(place))}
              onAddPin={(lat, lng) => addStop(pinStop(lat, lng))}
            />

            {draft.stops.length === 0 ? (
              <p
                className={cn(
                  'mt-4 rounded-[10px] border border-dashed px-4 py-6 text-center text-sm',
                  missing('stops') ? 'border-crumb-strong text-crumb-deep' : 'border-line-strong text-muted-foreground',
                )}
              >
                Search a place above, or type any name and tap <b>Add</b>. A trail needs at least 2 stops.
              </p>
            ) : (
              <ol className="mt-4 flex flex-col">
                {draft.stops.map((stop, index) => (
                  <li key={stop.key}>
                    {index > 0 ? (
                      <div className="flex items-center gap-2 py-2 pl-[13px]">
                        <span aria-hidden className="h-6 border-l-2 border-dotted border-crumb" />
                        <span className="ml-4 flex items-center gap-2 text-sm text-muted-foreground">
                          Getting here
                          <Dropdown
                            label={`Getting to ${stop.placeName}`}
                            value={stop.travelMode}
                            options={TRAVEL_OPTIONS}
                            onChange={(v) => updateStop(stop.key, { travelMode: v as TravelMode })}
                            buttonClassName="rounded-pill border border-line-strong bg-white px-3 py-1 text-sm font-semibold text-ink outline-none focus-visible:shadow-[var(--focus-ring)]"
                          />
                        </span>
                      </div>
                    ) : null}

                    <div className="rounded-[12px] border border-line bg-paper p-3">
                      <div className="flex items-start gap-3">
                        <span className="num-ring shrink-0" aria-hidden>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          {stop.experienceId ? (
                            <p className="truncate font-bold text-ink">{stop.placeName}</p>
                          ) : (
                            // Your own places, Google results and pins can be renamed.
                            <input
                              aria-label={`Name of stop ${index + 1}`}
                              className="w-full rounded-[8px] border border-transparent bg-transparent px-1 py-0.5 -ml-1 font-bold text-ink outline-none hover:border-line focus:border-line-strong focus:bg-white focus:shadow-[var(--focus-ring)]"
                              value={stop.placeName}
                              maxLength={120}
                              onChange={(e) => updateStop(stop.key, { placeName: e.target.value })}
                            />
                          )}
                          {stop.experienceId ? (
                            <p className="truncate text-sm text-muted-foreground">{stop.address}</p>
                          ) : (
                            <input
                              aria-label={`Address for ${stop.placeName}`}
                              className="mt-1 w-full rounded-[8px] border border-line-strong bg-white px-2.5 py-1.5 text-sm outline-none focus:shadow-[var(--focus-ring)]"
                              placeholder="Address (optional)"
                              value={stop.address}
                              onChange={(e) => updateStop(stop.key, { address: e.target.value })}
                            />
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className="icon-btn size-9 disabled:pointer-events-none disabled:opacity-30"
                            aria-label={`Move ${stop.placeName} up`}
                            disabled={index === 0}
                            onClick={() => moveStop(index, -1)}
                          >
                            <ArrowUp aria-hidden className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn size-9 disabled:pointer-events-none disabled:opacity-30"
                            aria-label={`Move ${stop.placeName} down`}
                            disabled={index === draft.stops.length - 1}
                            onClick={() => moveStop(index, 1)}
                          >
                            <ArrowDown aria-hidden className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn size-9 disabled:pointer-events-none disabled:opacity-30"
                            aria-label={`Remove ${stop.placeName}`}
                            onClick={() => removeStop(stop.key)}
                          >
                            <X aria-hidden className="size-4" />
                          </button>
                        </div>
                      </div>
                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-semibold tracking-wide text-crumb-strong uppercase">
                          Crumb <span className="font-normal tracking-normal text-muted-foreground normal-case">(optional)</span>
                        </span>
                        <input
                          id={`crumb-${stop.key}`}
                          className="w-full rounded-[8px] border border-line-strong bg-white px-3 py-2 text-sm outline-none focus:shadow-[var(--focus-ring)]"
                          maxLength={200}
                          placeholder="A small thing to do here, e.g. Dig through the outdoor sale lot"
                          value={stop.crumb}
                          onChange={(e) => updateStop(stop.key, { crumb: e.target.value })}
                        />
                      </label>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {draft.stops.length > 0 && draft.stops.length < MAX_STOPS ? (
              <button
                type="button"
                // Don't take focus from the search box on press; focusSearch handles it.
                onMouseDown={(event) => event.preventDefault()}
                onClick={focusSearch}
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed px-4 py-3 text-sm font-semibold',
                  'cursor-pointer hover:bg-paper focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
                  missing('stops') ? 'border-crumb-strong text-crumb-deep' : 'border-line-strong text-ink-2',
                )}
              >
                <Plus aria-hidden className="size-4" />
                Add another stop
              </button>
            ) : null}
          </Panel>
        </div>

        {/* ------------------------------------------------------- Sidebar */}
        <aside className="mt-4 flex flex-col gap-4 lg:sticky lg:top-24 lg:mt-0">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-2">Preview · how it shows in the feed</p>
            <div inert className="pointer-events-none">
              <TrailCard trail={preview} />
            </div>
          </div>

          {draft.stops.length > 0 ? (
            <RouteMap
              className="aspect-[4/3]"
              stops={draft.stops.map((s, i) => ({
                id: s.key,
                placeName: s.placeName,
                latitude: s.latitude,
                longitude: s.longitude,
                travelModeToStop: i === 0 ? null : s.travelMode,
              }))}
            />
          ) : null}

          <Panel title="Estimates">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Cost per person</dt>
                <dd className="mt-0.5 font-bold text-ink">
                  {cost === null ? '—' : cost === 0 ? 'Free' : `~$${Math.round(cost)}`}
                </dd>
                <dd className="text-xs text-muted-foreground">Added up from your stops</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  <span id="trail-duration-label">About how long</span>
                </dt>
                <dd className="mt-0.5">
                  <Dropdown
                    id="trail-duration"
                    className="w-full"
                    label="About how long"
                    value={minutes === null ? '' : String(minutes)}
                    options={[
                      ...(minutes === null ? [{ value: '', label: '—' }] : []),
                      ...DURATION_OPTIONS.map((m) => ({ value: String(m), label: formatMinutes(m) })),
                    ]}
                    onChange={(v) => update({ durationMinutes: v ? Number(v) : null })}
                    buttonClassName="w-full rounded-[8px] border border-line-strong bg-white px-2.5 py-1.5 font-bold text-ink outline-none focus-visible:shadow-[var(--focus-ring)]"
                  />
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {draft.durationMinutes === null ? 'Suggested, change it if needed' : 'Set by you'}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Ready to publish">
            <ul className="flex flex-col gap-2 text-sm">
              {checklist.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => jumpTo(item.key)}
                    disabled={item.done}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-[6px] text-left focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-default"
                  >
                    {item.done ? (
                      <Check aria-hidden className="size-4 shrink-0 rounded-full bg-done p-0.5 text-white" />
                    ) : (
                      <Circle aria-hidden className={cn('size-4 shrink-0', showMissing ? 'text-crumb-strong' : 'text-line-strong')} />
                    )}
                    <span className={item.done ? 'text-ink' : showMissing ? 'text-crumb-deep underline' : 'text-muted-foreground hover:underline'}>
                      {item.label}
                    </span>
                    <span className="sr-only">{item.done ? '(done)' : '(not done yet, go to it)'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {aside}
        </aside>
      </div>
    </div>
  )
}
