/**
 * Explore page, "Trails for you" (docs/mockups/Web-Explore + Main): tabs For you /
 * Nearby / Friends (only For you works for now), cost and length filters, a grid of
 * TrailCards and, on wide screens, a map of where the shown trails start (TrailsMap).
 * Hovering a card highlights its pin and vice versa; clicking a pin opens the trail.
 * Reads ?q= from the header search. Data: loadTrails() in ./api (getFeed + starts).
 * Route: / · Owner: Jason
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { TrailCard } from '@/components/TrailCard'
import { TrailsMap, TrailsMapLegend } from '@/components/TrailsMap'
import { cn } from '@/lib/utils'
import emptyTrail from '../../../docs/assets/svg/empty-trail.svg'
import { loadTrails, matchesSearch, type MapTrail } from './api'

type Tab = 'for-you' | 'nearby' | 'friends'

const TABS: { id: Tab; label: string }[] = [
  { id: 'for-you', label: 'For you' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'friends', label: 'Friends' },
]

const COST_OPTIONS = [
  { value: '', label: 'Any cost' },
  { value: '0', label: 'Free' },
  { value: '10', label: 'Under $10' },
  { value: '20', label: 'Under $20' },
  { value: '35', label: 'Under $35' },
]

const LENGTH_OPTIONS = [
  { value: '', label: 'Any length' },
  { value: '60', label: 'Up to 1 hr' },
  { value: '120', label: 'Up to 2 hr' },
  { value: '180', label: 'Up to 3 hr' },
]

/** A filter chip: a native <select> styled as an outlined pill. */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const active = value !== ''
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          'h-11 cursor-pointer appearance-none rounded-pill md:h-[38px] bg-white pr-9 pl-3.5 text-sm font-semibold outline-none focus-visible:shadow-[var(--focus-ring)] ' +
          (active
            ? 'text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]'
            : 'text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]')
        }
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-2" />
    </label>
  )
}

/** Grey card-shaped blocks while the feed loads. */
function FeedSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[196px] animate-pulse rounded-card border border-line bg-sand" aria-hidden />
      ))}
    </>
  )
}

/** Friendly message in place of the grid (empty results, coming-soon tabs, errors). */
function FeedMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="col-span-full rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <img src={emptyTrail} alt="" aria-hidden className="mx-auto mb-4 h-10 w-auto" />
      <p className="text-lg font-bold text-ink">{title}</p>
      {children ? <div className="mt-2 text-base text-ink-2">{children}</div> : null}
    </div>
  )
}

export function ExplorePage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [tab, setTab] = useState<Tab>('for-you')
  const [cost, setCost] = useState('')
  const [length, setLength] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; trails?: MapTrail[]; error?: string } | null>(null)
  // The trail being pointed at, and whether that's from its card or its map pin.
  const [hover, setHover] = useState<{ id: string; from: 'card' | 'pin' } | null>(null)
  const [mapAvailable, setMapAvailable] = useState(true)
  const navigate = useNavigate()

  const key = `${cost}|${length}|${attempt}`
  const loading = result?.key !== key

  useEffect(() => {
    let cancelled = false
    loadTrails({
      maxCost: cost === '' ? undefined : Number(cost),
      maxMinutes: length === '' ? undefined : Number(length),
    }).then(
      (trails) => !cancelled && setResult({ key, trails }),
      (error: unknown) =>
        !cancelled && setResult({ key, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    )
    return () => {
      cancelled = true
    }
  }, [key, cost, length])

  const trails = (result?.trails ?? []).filter((t) => !q || matchesSearch(t, q))
  const filtered = cost !== '' || length !== ''
  // The map shows the same trails as the grid (nothing on the coming-soon tabs).
  const mapTrails = tab === 'for-you' && !loading ? trails : []

  function clearFilters() {
    setCost('')
    setLength('')
  }

  let body: ReactNode
  if (tab !== 'for-you') {
    body = (
      <FeedMessage title={tab === 'nearby' ? 'Nearby is coming soon' : 'Friends is coming soon'}>
        {tab === 'nearby'
          ? 'Trails close to where you are right now. Your location is used live and never saved.'
          : 'Trails your friends made, saved or finished.'}
      </FeedMessage>
    )
  } else if (loading) {
    body = <FeedSkeleton />
  } else if (result?.error) {
    body = (
      <FeedMessage title="Couldn't load trails">
        <p>{result.error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </FeedMessage>
    )
  } else if (trails.length === 0) {
    body = (
      <FeedMessage title="No trails match">
        <p>{q ? `Nothing found for “${q}”.` : 'Try a higher cost or a longer length.'}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {q ? (
            <Link to="/" className="btn btn--sm btn--secondary">
              Clear search
            </Link>
          ) : null}
          {filtered ? (
            <button type="button" className="btn btn--sm btn--secondary" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      </FeedMessage>
    )
  } else {
    body = trails.map((trail) => (
      <div
        key={trail.id}
        className={cn(
          'rounded-card transition-shadow',
          hover?.id === trail.id && hover.from === 'pin' && 'shadow-[0_0_0_2px_var(--color-crumb)]',
        )}
        onMouseEnter={() => setHover({ id: trail.id, from: 'card' })}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover({ id: trail.id, from: 'card' })}
        onBlur={() => setHover(null)}
      >
        <TrailCard trail={trail} className="h-full" />
      </div>
    ))
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-8">
      <section aria-labelledby="feed-title" className="min-w-0">
        <h1
          id="feed-title"
          className="text-[2rem] leading-[var(--leading-tight)] font-extrabold tracking-[var(--tracking-title)] text-ink md:text-[2.5rem]"
        >
          Trails for you
        </h1>
        <p className="mt-1.5 text-md text-ink-2 md:mt-2 md:text-lg">You've lived here. Have you explored it?</p>

        <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-3 md:mt-5">
          <div role="tablist" aria-label="Feed" className="flex flex-wrap gap-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls="feed-panel"
                className="tab"
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'for-you' ? (
            <div className="flex flex-wrap gap-2">
              <FilterSelect label="Cost" value={cost} options={COST_OPTIONS} onChange={setCost} />
              <FilterSelect label="Length" value={length} options={LENGTH_OPTIONS} onChange={setLength} />
            </div>
          ) : null}
        </div>

        {q && tab === 'for-you' && !loading && trails.length > 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            {trails.length} {trails.length === 1 ? 'trail' : 'trails'} for “{q}” ·{' '}
            <Link to="/" className="font-semibold text-crumb-strong hover:text-crumb-deep">
              Clear search
            </Link>
          </p>
        ) : null}

        <div
          id="feed-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          aria-busy={tab === 'for-you' && loading}
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3 md:gap-4"
        >
          {body}
        </div>
      </section>

      <aside aria-label="Trails on the map" className="sticky top-24 hidden lg:block">
        <TrailsMap
          trails={mapTrails}
          highlightedId={hover?.id ?? null}
          onHover={(id) => setHover(id ? { id, from: 'pin' } : null)}
          onSelect={(id) => navigate(`/trails/${id}`)}
          onStatusChange={(status) => setMapAvailable(status !== 'unavailable')}
          className="aspect-[440/600] max-h-[calc(100dvh-160px)] w-full"
        />
        {mapAvailable && mapTrails.length > 0 ? <TrailsMapLegend trails={mapTrails} className="mt-3" /> : null}
      </aside>
    </div>
  )
}
