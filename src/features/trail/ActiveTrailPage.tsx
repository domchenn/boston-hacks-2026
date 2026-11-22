/**
 * Active trail ("Start trail" mode), per docs/mockups/Mobile-Run.dc.html: live map
 * with the user's position, the current stop with directions and its crumbs, the
 * whole trail's crumbs grouped by stop, photos (camera on ticked crumbs, Add photos;
 * see ActiveTrailPhotos), and Finished / Save for later / Abort.
 * Opening the page starts (or resumes) the trail. Location is asked for only here
 * and never stored; the screen stays awake while the page is open.
 * Route: /trails/:id/go · Owner: Gio
 */
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  LocateFixed,
  LocateOff,
  Navigation,
} from 'lucide-react'
import { RouteMap } from '@/components/RouteMap'
import type { TrailDetail } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'
import { CrumbChecklist, TrailChecklist } from './ActiveTrailCrumbs'
import { CrumbPhotoButton, TrailPhotosPanel } from './ActiveTrailPhotos'
import { directionsLink } from './directions-link'
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
  return <ActiveTrailView trail={load.trail} finished={load.myStatus === 'completed'} location={location} {...state} />
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
  ticked,
  pendingCrumbs,
  crumbError,
  toggle,
  busy,
  actionError,
  run,
}: ViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [confirmAbort, setConfirmAbort] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const { stops } = trail

  const allCrumbs = [...stops.flatMap((s) => s.crumbs), ...trail.betweenStopCrumbs]
  const doneCount = allCrumbs.filter((c) => ticked.has(c.id)).length

  // Current stop: ?stop= (1-based, survives refresh), else the first stop with crumbs left.
  const requested = Number(searchParams.get('stop'))
  const firstOpen = stops.findIndex((s) => s.crumbs.some((c) => !ticked.has(c.id)))
  const currentIndex =
    Number.isInteger(requested) && requested >= 1 && requested <= stops.length
      ? requested - 1
      : Math.max(firstOpen, 0)
  const current = stops[currentIndex] ?? null

  const goToStop = (index: number) =>
    setSearchParams(
      (params) => {
        params.set('stop', String(index + 1))
        return params
      },
      { replace: true },
    )

  return (
    <div className="pb-48 md:pb-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] lg:items-start lg:gap-8">
      {/* Map: full-bleed on phones (under the sheet), sticky right column on desktop. */}
      <div className="relative -mx-4 -mt-5 md:mx-0 md:mt-0 lg:sticky lg:top-24 lg:order-2">
        <RouteMap
          stops={stops}
          primaryLine={trail.primaryLine}
          mode="live"
          userLocation={location.status === 'on' ? location.location : null}
          selectedStopId={current?.id ?? null}
          onSelectStop={(stopId) => {
            const index = stops.findIndex((s) => s.id === stopId)
            if (index >= 0) goToStop(index)
          }}
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
        aria-labelledby="active-stop-title"
        className="relative -mx-4 -mt-6 rounded-t-[var(--radius-sheet)] bg-paper px-4 pt-5 shadow-[var(--shadow-sheet)] md:mx-0 md:mt-6 md:rounded-none md:bg-transparent md:px-0 md:pt-0 md:shadow-none lg:order-1 lg:mt-0"
      >
        <LocationNote location={location} />

        {finished ? (
          <p className="mt-3 rounded-card bg-[var(--color-green-tint)] px-4 py-3 text-base text-ink">
            <b>You finished this trail.</b> You can still look back over your crumbs.
          </p>
        ) : null}

        {current ? (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold text-crumb-strong">
                Stop {currentIndex + 1} of {stops.length}
                {firstOpen === currentIndex && !finished ? ' · next up' : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="icon-btn disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous stop"
                  disabled={currentIndex === 0}
                  onClick={() => goToStop(currentIndex - 1)}
                >
                  <ChevronLeft aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-btn disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next stop"
                  disabled={currentIndex === stops.length - 1}
                  onClick={() => goToStop(currentIndex + 1)}
                >
                  <ChevronRight aria-hidden />
                </button>
              </div>
            </div>
            <h1
              id="active-stop-title"
              className="mt-1.5 text-[1.75rem] leading-[var(--leading-tight)] font-extrabold tracking-[var(--tracking-title)] text-ink"
            >
              {current.placeName}
            </h1>
            {current.address ? <p className="mt-1 text-base text-ink-2">{current.address}</p> : null}
            {current.plannedActivity ? <p className="mt-3 text-base leading-normal text-ink">{current.plannedActivity}</p> : null}
            <a
              href={directionsLink(current)}
              target="_blank"
              rel="noreferrer"
              className="btn btn--secondary btn--sm mt-4"
            >
              <Navigation aria-hidden />
              Open in Google Maps
              <span className="sr-only"> (directions to {current.placeName}, opens in a new tab)</span>
            </a>

            <CrumbChecklist
              title="Crumbs here"
              crumbs={current.crumbs}
              ticked={ticked}
              pending={pendingCrumbs}
              onToggle={toggle}
              renderDoneExtra={(crumb) => (
                <CrumbPhotoButton crumbId={crumb.id} label={crumb.label} onError={setPhotoError} />
              )}
            />
          </>
        ) : (
          <h1 id="active-stop-title" className="mt-4 text-2xl font-extrabold">
            {trail.title}
          </h1>
        )}

        {crumbError ? <InlineError>{crumbError}</InlineError> : null}
        {photoError ? <InlineError>{photoError}</InlineError> : null}

        <TrailPhotosPanel trailId={trail.id} />

        <h2 className="mt-8 mb-0 flex items-baseline justify-between gap-3 text-base font-bold">
          The whole trail
          {allCrumbs.length > 0 ? (
            <span className="text-sm font-normal text-muted-foreground" aria-live="polite">
              {doneCount} of {allCrumbs.length} crumbs
            </span>
          ) : null}
        </h2>
        <TrailChecklist
          stops={stops}
          primaryLine={trail.primaryLine}
          betweenStopCrumbs={trail.betweenStopCrumbs}
          currentIndex={currentIndex}
          onSelectStop={(i) => {
            goToStop(i)
            document.getElementById('active-stop-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
          ticked={ticked}
          pending={pendingCrumbs}
          onToggle={toggle}
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
            <div role="group" aria-label="Abort this trail?" className="rounded-card border border-line bg-white p-4">
              <p className="m-0 font-bold">Abort this trail?</p>
              <p className="mt-1 mb-3 text-sm text-ink-2">It won’t count as finished. Your ticked crumbs are kept.</p>
              <div className="flex gap-3">
                <button type="button" className="btn btn--ink flex-1" onClick={() => run('abort')} disabled={busy !== null}>
                  {busy === 'abort' ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                  Yes, abort
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
                Finished
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
                  Abort
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
