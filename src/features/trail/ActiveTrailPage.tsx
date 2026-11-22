/**
 * Active trail ("Start trail" mode), per docs/mockups/Mobile-Run.dc.html: live map
 * with the user's position and the trail as an accordion of stops
 * (ActiveTrailStops): the stop you're at is open with how to get there, its
 * crumbs and a photo button; finishing a stop (its circle, "Done here", or the
 * last crumb) folds it away and opens the next. Then Finished / Save for later / Stop.
 * Opening the page starts an outing of the trail, or resumes the one you're on
 * (useActiveTrail); friends you invite (OutingCrew) share its checklist. Location is asked for only here
 * and never stored; the screen stays awake while the page is open.
 * Route: /trails/:id/go · Owner: Gio
 */
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, CircleAlert, LoaderCircle, LocateFixed, LocateOff } from 'lucide-react'
import { RouteMap } from '@/components/RouteMap'
import { TransitAlerts } from '@/components/TransitAlerts'
import type { TrailDetail, TrailStop } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'
import { useStopPhotos } from './useStopPhotos'
import { ActiveTrailStops } from './ActiveTrailStops'
import { OutingCrew } from './OutingCrew'
import { useActiveTrail } from './useActiveTrail'
import { useLiveLocation, type LocationState } from './useLiveLocation'
import { useWakeLock } from './useWakeLock'

export function ActiveTrailPage() {
  const { id = '' } = useParams()
  const { session, loading } = useSession()
  if (loading) return <ActiveTrailSkeleton />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(`/trails/${id}/go`)}`} replace />
  // Keyed so another trail or account starts from scratch.
  return <ActiveTrail key={`${session.user.id}:${id}`} trailId={id} />
}

function ActiveTrail({ trailId }: { trailId: string }) {
  const state = useActiveTrail(trailId)
  const { load } = state
  const ready = load.status === 'ready'
  const location = useLiveLocation(ready)
  useWakeLock(ready)

  if (load.status === 'loading') return <ActiveTrailSkeleton />
  if (load.status === 'not_found') {
    return (
      <Message title="This trail isn’t here">
        It may have been removed or made private.{' '}
        <Link to="/" className="font-semibold text-crumb-strong hover:text-crumb-deep">
          Explore other trails
        </Link>
      </Message>
    )
  }
  if (load.status === 'error') {
    return (
      <Message title={load.message}>
        <button type="button" className="btn btn--sm btn--secondary mt-2" onClick={state.retry}>
          Try again
        </button>
      </Message>
    )
  }
  // Finished = this outing is done (you, or a friend on it, tapped Finished).
  return <ActiveTrailView trail={load.trail} finished={state.outing?.status === 'completed'} location={location} {...state} />
}

type ViewProps = Omit<ReturnType<typeof useActiveTrail>, 'load' | 'retry'> & {
  trail: TrailDetail
  finished: boolean
  location: LocationState
}

function ActiveTrailView({
  trail,
  finished,
  location,
  outing,
  ticks,
  ticked,
  pendingCrumbs,
  crumbError,
  toggle,
  setCrumbs,
  busy,
  actionError,
  run,
  invite,
}: ViewProps) {
  const { session } = useSession()
  const viewerId = session?.user.id ?? null
  const withFriends = (outing?.members ?? []).some((m) => m.status === 'joined' && m.person.id !== viewerId)
  /** "Maya" when a friend ticked this crumb (nothing for your own ticks). */
  const tickedBy = (crumbId: string) => {
    const by = ticks.get(crumbId)
    if (!by || by === viewerId) return null
    const person = outing?.members.find((m) => m.person.id === by)?.person
    return person ? person.display_name || (person.username ? `@${person.username}` : null) : null
  }
  const photos = useStopPhotos(trail.id, viewerId, outing?.id ?? null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [confirmAbort, setConfirmAbort] = useState(false)
  const { stops } = trail

  const allCrumbs = [...stops.flatMap((s) => s.crumbs), ...trail.betweenStopCrumbs]
  const doneCount = allCrumbs.filter((c) => ticked.has(c.id)).length
  const allDone = allCrumbs.length > 0 && doneCount === allCrumbs.length
  // Next up: the first stop with crumbs left (-1 when every stop is done).
  const nextIndex = stops.findIndex((s) => s.crumbs.some((c) => !ticked.has(c.id)))

  // The stop in focus: ?stop= (1-based, survives refresh), else the next stop.
  const requested = Number(searchParams.get('stop'))
  const focusedIndex =
    Number.isInteger(requested) && requested >= 1 && requested <= stops.length ? requested - 1 : Math.max(nextIndex, 0)
  const focused = stops[focusedIndex] ?? null
  // Open stops: starts with the stop in focus.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(focused ? [focused.id] : []))

  const rememberStop = (index: number) =>
    setSearchParams(
      (params) => {
        params.set('stop', String(index + 1))
        return params
      },
      { replace: true },
    )

  const scrollToStop = (stopId: string) =>
    setTimeout(() => document.getElementById(`stop-${stopId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)

  function openStop(index: number) {
    const stop = stops[index]
    if (!stop) return
    setOpenIds((prev) => new Set(prev).add(stop.id))
    rememberStop(index)
    scrollToStop(stop.id)
  }

  /** Done at stop `index`: fold it away and open the next stop that still has crumbs. */
  function moveOn(index: number) {
    const later = stops.findIndex((s, j) => j > index && s.crumbs.some((c) => !ticked.has(c.id)))
    const target = later >= 0 ? later : index + 1 < stops.length ? index + 1 : -1
    setOpenIds((prev) => {
      const next = new Set(prev)
      next.delete(stops[index].id)
      if (target >= 0) next.add(stops[target].id)
      return next
    })
    if (target >= 0) {
      rememberStop(target)
      scrollToStop(stops[target].id)
    }
  }

  function toggleCrumb(crumbId: string) {
    const index = stops.findIndex((s) => s.crumbs.some((c) => c.id === crumbId))
    const ticking = !ticked.has(crumbId)
    toggle(crumbId)
    // Ticking the last crumb at a stop moves on, like "Done here".
    if (index >= 0 && ticking && stops[index].crumbs.every((c) => c.id === crumbId || ticked.has(c.id))) moveOn(index)
  }

  function setStop(stop: TrailStop, done: boolean) {
    setCrumbs(
      stop.crumbs.map((c) => c.id),
      done,
    )
    if (done) moveOn(stops.indexOf(stop))
  }

  return (
    <div className="pb-48 md:pb-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] lg:items-start lg:gap-8">
      {/* Map: full-bleed on phones (under the sheet), sticky right column on desktop. */}
      <div className="relative -mx-4 -mt-5 md:mx-0 md:mt-0 lg:sticky lg:top-24 lg:order-2">
        <RouteMap
          stops={stops}
          primaryLine={trail.primaryLine}
          mode="live"
          userLocation={location.status === 'on' ? location.location : null}
          selectedStopId={focused?.id ?? null}
          onSelectStop={(stopId) => openStop(stops.findIndex((s) => s.id === stopId))}
          className="aspect-auto h-[42vh] min-h-[260px] rounded-none border-0 md:rounded-card md:border lg:h-[calc(100dvh-8rem)]"
        />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
          <Link to={`/trails/${trail.id}`} className="icon-btn icon-btn--float" aria-label="Leave trail">
            <ChevronLeft aria-hidden />
          </Link>
          <div className="flex h-10 min-w-0 items-center gap-2 rounded-pill bg-white px-4 text-sm font-semibold shadow-float">
            <span aria-hidden className="size-2 flex-none rounded-full bg-crumb-strong" />
            <span className="min-w-0 truncate">{trail.title}</span>
            {allCrumbs.length > 0 ? (
              <span className="flex-none text-muted-foreground">
                · {doneCount}/{allCrumbs.length}
              </span>
            ) : null}
          </div>
          <span aria-hidden className="w-11 flex-none" />
        </div>
      </div>

      {/* Sheet */}
      <section
        aria-labelledby="active-trail-title"
        className="relative -mx-4 -mt-6 rounded-t-[var(--radius-sheet)] bg-paper px-4 pt-5 shadow-[var(--shadow-sheet)] md:mx-0 md:mt-6 md:rounded-none md:bg-transparent md:px-0 md:pt-0 md:shadow-none lg:order-1 lg:mt-0"
      >
        <LocationNote location={location} />

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <h1
            id="active-trail-title"
            className="m-0 text-[1.5rem] leading-[var(--leading-tight)] font-extrabold tracking-[var(--tracking-title)] text-ink"
          >
            {trail.title}
          </h1>
          {allCrumbs.length > 0 ? (
            <span className="flex-none text-sm text-muted-foreground" aria-live="polite">
              {doneCount} of {allCrumbs.length} crumbs
            </span>
          ) : null}
        </div>
        <p className="mt-1 mb-0 text-sm text-ink-2">
          Tap a stop’s circle when you’re done there. The next stop opens by itself.
        </p>

        {finished ? (
          <p className="mt-3 rounded-card bg-[var(--color-green-tint)] px-4 py-3 text-base text-ink">
            <b>This outing is finished.</b> Rate the trail, or look back over your crumbs.
          </p>
        ) : allDone ? (
          <p className="mt-3 rounded-card bg-[var(--color-green-tint)] px-4 py-3 text-base text-ink">
            <b>Every crumb done.</b> Tap <b>Finished</b> to wrap up and rate the trail.
          </p>
        ) : null}

        {outing && viewerId ? <OutingCrew outing={outing} viewerId={viewerId} onInvite={invite} finished={finished} /> : null}

        <TransitAlerts stops={stops} className="mt-3" />

        {crumbError ? <InlineError>{crumbError}</InlineError> : null}
        {photos.error ? <InlineError>{photos.error}</InlineError> : null}

        <ActiveTrailStops
          stops={stops}
          betweenStopCrumbs={trail.betweenStopCrumbs}
          primaryLine={trail.primaryLine}
          nextIndex={nextIndex}
          openIds={openIds}
          onToggleOpen={(stopId) => {
            const next = new Set(openIds)
            if (next.has(stopId)) next.delete(stopId)
            else {
              next.add(stopId)
              rememberStop(stops.findIndex((s) => s.id === stopId))
            }
            setOpenIds(next)
          }}
          ticked={ticked}
          tickedBy={tickedBy}
          pending={pendingCrumbs}
          onToggleCrumb={toggleCrumb}
          onSetStop={setStop}
          onNext={moveOn}
          photos={photos}
          finished={finished}
        />

        {/* Bottom actions: a fixed bar on phones, inline on larger screens. */}
        <div className="action-bar fixed inset-x-0 bottom-0 z-20 md:static md:mt-6 md:bg-none md:p-0">
          {actionError ? <InlineError>{actionError}</InlineError> : null}
          {finished ? (
            <div className="flex gap-3">
              <Link to={`/trails/${trail.id}/rate`} className="btn btn--lg flex-1">
                Rate this trail
              </Link>
              <Link to={`/trails/${trail.id}`} className="btn btn--lg btn--secondary">
                Done
              </Link>
            </div>
          ) : confirmAbort ? (
            <div role="group" aria-label="Stop this trail?" className="rounded-card border border-line bg-white p-4">
              <p className="m-0 font-bold">{withFriends ? 'Leave this outing?' : 'Stop this trail?'}</p>
              <p className="mt-1 mb-3 text-sm text-ink-2">
                {withFriends
                  ? 'Your friends can keep going without you. It won’t count as finished for you.'
                  : 'It won’t count as finished. You can start it again any time.'}
              </p>
              <div className="flex gap-3">
                <button type="button" className="btn btn--ink flex-1" onClick={() => run('abort')} disabled={busy !== null}>
                  {busy === 'abort' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  {withFriends ? 'Yes, leave' : 'Yes, stop'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary flex-1"
                  onClick={() => setConfirmAbort(false)}
                  disabled={busy !== null}
                  autoFocus
                >
                  Keep going
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <button type="button" className="btn btn--lg btn--block" onClick={() => run('finish')} disabled={busy !== null}>
                {busy === 'finish' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                {withFriends ? 'We’re finished' : 'Finished'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn--secondary" onClick={() => run('save')} disabled={busy !== null}>
                  {busy === 'save' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  Save for later
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirmAbort(true)}
                  disabled={busy !== null}
                >
                  {withFriends ? 'Leave' : 'Stop'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/** One line about location, so a denied or missing fix never looks like a bug. */
function LocationNote({ location }: { location: LocationState }) {
  const copy: Record<LocationState['status'], { icon: typeof LocateFixed; text: string }> = {
    asking: { icon: LocateFixed, text: 'Finding you… allow location to see yourself on the map.' },
    on: { icon: LocateFixed, text: 'Showing where you are. Your location stays on this phone.' },
    denied: {
      icon: LocateOff,
      text: 'Location is off, so the map just shows the trail. To see yourself on it, allow location for this site in your browser settings.',
    },
    unavailable: { icon: LocateOff, text: 'Can’t find your location right now. The map still shows the trail.' },
    unsupported: {
      icon: LocateOff,
      text: 'This browser can’t share your location here (it needs a secure https:// page). The map still shows the trail.',
    },
  }
  const { icon: Icon, text } = copy[location.status]
  return (
    <p role="status" className="m-0 flex items-start gap-2 text-sm text-muted-foreground">
      <Icon aria-hidden className={cn('mt-0.5 size-4 flex-none', location.status === 'on' && 'text-scheduled')} />
      {text}
    </p>
  )
}

function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 mb-2 flex items-start gap-2 rounded-[var(--radius-md)] bg-crumb-tint px-3 py-2.5 text-sm text-ink">
      <CircleAlert aria-hidden className="mt-0.5 size-4 flex-none text-crumb-deep" />
      {children}
    </p>
  )
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-4 max-w-xl rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <p className="text-xl font-bold">{title}</p>
      <div className="mt-2 text-base text-ink-2">{children}</div>
    </div>
  )
}

function ActiveTrailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading trail" className="animate-pulse">
      <div className="-mx-4 -mt-5 h-[42vh] min-h-[260px] bg-sand md:mx-0 md:mt-0 md:rounded-card" />
      <div className="mt-5 space-y-3">
        <div className="h-4 w-32 rounded-pill bg-sand" />
        <div className="h-8 w-2/3 rounded-pill bg-sand" />
        <div className="h-40 w-full rounded-card bg-sand" />
      </div>
    </div>
  )
}
