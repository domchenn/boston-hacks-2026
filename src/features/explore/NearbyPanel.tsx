/**
 * Explore's Nearby tab (task G7): the same trails as For you (same filters and
 * search), sorted by distance from you to each trail's first stop, with
 * "0.4 mi away" on the cards. Location is asked for only when this tab is opened,
 * kept in memory only, and never stored or sent. If it's denied or unavailable,
 * a short note explains why and the trails show in the usual order. Once located,
 * a slider (RadiusSlider) limits the list to trails within a distance; the page
 * hears which trails are shown (onShown) so its map matches.
 * Renders straight into Explore's card grid (cards plus full-width notes).
 */
import { useEffect, type ReactNode } from 'react'
import { LoaderCircle, LocateFixed, LocateOff } from 'lucide-react'
import { TrailCard } from '@/components/TrailCard'
import type { MapTrail } from './api'
import { radiusLabel, sortByDistance, withinRadius, type NearbyTrail } from './nearby'
import { RadiusSlider } from './RadiusSlider'
import { useNearbyLocation, type NearbyLocation } from './useNearbyLocation'

type NearbyPanelProps = {
  /** The feed for the current filters and search; null while it loads. */
  trails: MapTrail[] | null
  /** Set when the feed failed to load. */
  error: string | null
  onRetry: () => void
  hoverId: string | null
  onHover: (id: string | null) => void
  /** Miles from you, or null for any distance (Explore keeps it in ?radius=). */
  radius: number | null
  onRadiusChange: (miles: number | null) => void
  /** The trails shown right now, so Explore's map can match; null = not decided yet (show the feed). */
  onShown: (ids: string[] | null) => void
}

const OFF_COPY: Record<'denied' | 'unavailable' | 'unsupported', { title: string; text: string }> = {
  denied: {
    title: 'Location is off',
    text: 'To sort trails by distance, allow location for this site in your browser settings, then try again. Here are all trails for now.',
  },
  unavailable: {
    title: 'Couldn’t find where you are',
    text: 'Your device didn’t give a location just now. Try again in a moment. Here are all trails for now.',
  },
  unsupported: {
    title: 'Location isn’t available here',
    text: 'This browser can’t share your location on this page (it needs a secure https:// link). Here are all trails for now.',
  },
}

export function NearbyPanel({ trails, error, onRetry, hoverId, onHover, radius, onRadiusChange, onShown }: NearbyPanelProps) {
  // Mounting this panel = opening the Nearby tab, which is when location is asked for.
  const location = useNearbyLocation(true)
  const located = location.status === 'on'
  const sorted: NearbyTrail[] | null =
    trails === null ? null : location.status === 'on' ? sortByDistance(trails, location.position) : trails
  // The radius only applies once we know where you are.
  const shown = sorted === null ? null : located ? withinRadius(sorted, radius) : sorted
  const shownKey = shown ? shown.map((t) => t.id).join(',') : null

  useEffect(() => {
    onShown(shownKey === null ? null : shownKey ? shownKey.split(',') : [])
  }, [shownKey, onShown])
  useEffect(() => () => onShown(null), [onShown])

  if (error) {
    return (
      <Note title="Couldn't load trails">
        <p className="m-0">{error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={onRetry}>
          Try again
        </button>
      </Note>
    )
  }

  if (location.status === 'asking' || trails === null || shown === null) {
    return (
      <>
        <StatusLine location={location} />
        <Skeletons />
      </>
    )
  }

  if (trails.length === 0) {
    return (
      <Note title="No trails to show">
        <p className="m-0">Nothing matches right now. Try another filter or search on For you.</p>
      </Note>
    )
  }

  return (
    <>
      {location.status === 'on' ? (
        <>
          <StatusLine location={location} />
          <RadiusSlider value={radius} onChange={onRadiusChange} />
        </>
      ) : (
        <OffNote status={location.status} onRetry={location.retry} />
      )}
      {shown.length === 0 ? (
        <Note title={`No trails ${radiusLabel(radius).toLowerCase()}`}>
          <p className="m-0">Drag the slider further to see trails a bit farther away.</p>
          <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={() => onRadiusChange(null)}>
            Show any distance
          </button>
        </Note>
      ) : null}
      {shown.map((trail) => (
        <div
          key={trail.id}
          onMouseEnter={() => onHover(trail.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(trail.id)}
          onBlur={() => onHover(null)}
        >
          <TrailCard trail={trail} selected={hoverId === trail.id} className="h-full" />
        </div>
      ))}
    </>
  )
}

/** "Nearest first…" once located; "Finding trails near you…" while asking. */
function StatusLine({ location }: { location: NearbyLocation & { retry: () => void } }) {
  const on = location.status === 'on'
  return (
    <div role="status" className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        {on ? (
          <LocateFixed aria-hidden className="size-4 text-scheduled" />
        ) : (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        )}
        {on ? 'Nearest first, from where you are now. Your location stays on this device.' : 'Finding trails near you…'}
      </span>
      {on ? (
        <button
          type="button"
          onClick={location.retry}
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:text-crumb-deep hover:underline"
        >
          Update location
        </button>
      ) : null}
    </div>
  )
}

function OffNote({ status, onRetry }: { status: 'denied' | 'unavailable' | 'unsupported'; onRetry: () => void }) {
  const { title, text } = OFF_COPY[status]
  return (
    <div role="status" className="col-span-full flex items-start gap-3 rounded-card border border-line bg-white px-4 py-3.5">
      <LocateOff aria-hidden className="mt-0.5 size-5 flex-none text-muted-foreground" />
      <div className="min-w-0">
        <p className="m-0 font-bold text-ink">{title}</p>
        <p className="mt-0.5 mb-0 text-sm text-ink-2">{text}</p>
        {status !== 'unsupported' ? (
          <button type="button" className="btn btn--sm btn--secondary mt-3" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="col-span-full rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      <div className="mt-2 text-base text-ink-2">{children}</div>
    </div>
  )
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[196px] animate-pulse rounded-card border border-line bg-sand" aria-hidden />
      ))}
    </>
  )
}
