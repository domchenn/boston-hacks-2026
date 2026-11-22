/**
 * Explore page, "Trails for you" (docs/mockups/Web-Explore + Main): tabs For you /
 * Nearby / Friends (only For you works for now), filters (category, neighborhood,
 * cost, length, Late night, Near a T station), a grid of TrailCards and, on wide
 * screens, a map of where the shown trails start (TrailsMap). Hovering a card
 * highlights its pin and vice versa; clicking a pin opens the trail.
 * Filters and the header search (?q=) live in the URL so a filtered feed can be
 * shared (see ./filters). Data: loadTrails() and loadNeighborhoods() in ./api.
 * Route: / · Owner: Jason
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Moon, TrainFront } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { SHOW_COMMUNITIES, useCommunities } from '@/features/communities/api'
import { CommunitySwitcher } from '@/features/communities/CommunitySwitcher'
import { TrailCard } from '@/components/TrailCard'
import { TrailsMap, TrailsMapLegend } from '@/components/TrailsMap'
import { cn } from '@/lib/utils'
import emptyTrail from '../../../docs/assets/svg/empty-trail.svg'
import { loadNeighborhoods, loadTrails, matchesSearch, NEAR_T_MILES, type MapTrail } from './api'
import { NearbyPanel } from './NearbyPanel'
import {
  CATEGORY_OPTIONS,
  COST_OPTIONS,
  FILTER_KEYS,
  LENGTH_OPTIONS,
  readFilterValues,
  toExploreFilters,
  withFilter,
  withoutFilters,
  type FilterKey,
} from './filters'

type Tab = 'for-you' | 'nearby' | 'friends'

const TABS: { id: Tab; label: string }[] = [
  { id: 'for-you', label: 'For you' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'friends', label: 'Friends' },
]

const pill =
  'h-11 cursor-pointer rounded-pill bg-white text-sm font-semibold outline-none transition-shadow focus-visible:shadow-[var(--focus-ring)] md:h-[38px]'
const pillOff = 'text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-ink-2)]'
const pillOn = 'text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]'

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
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(pill, 'max-w-[13rem] appearance-none truncate pr-9 pl-3.5', value !== '' ? pillOn : pillOff)}
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

/** An on/off quick filter (Late night, Near a T station), same pill look as the selects. */
function FilterToggle({
  label,
  icon,
  on,
  title,
  onChange,
}: {
  label: string
  icon: ReactNode
  on: boolean
  title?: string
  onChange: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={() => onChange(!on)}
      className={cn(pill, 'inline-flex items-center gap-1.5 px-3.5 [&_svg]:size-4', on ? pillOn : pillOff)}
    >
      {on ? <Check aria-hidden /> : icon}
      {label}
    </button>
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

/** Friendly message in place of the grid (empty results, coming-soon tabs, errors). Same look as Saved / You. */
function FeedMessage({ title, picture = true, children }: { title: string; picture?: boolean; children?: ReactNode }) {
  return (
    <div className="col-span-full rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      {picture ? <img src={emptyTrail} alt="" aria-hidden width={240} height={160} className="mx-auto mb-4 h-auto max-w-full" /> : null}
      <p className="text-lg font-bold text-ink">{title}</p>
      {children ? <div className="mt-2 text-base text-ink-2">{children}</div> : null}
    </div>
  )
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const values = readFilterValues(params)
  // Community switcher (task G6), kept in ?community=<slug> so it can be shared.
  const communitySlug = SHOW_COMMUNITIES ? (params.get('community') ?? '') : ''
  const communities = useCommunities()
  const communityId = communities?.find((c) => c.slug === communitySlug)?.id
  // Wait for the communities list before loading a ?community= link (no flash of "All").
  const communityPending = communitySlug !== '' && communities === null
  const activeCount = FILTER_KEYS.filter((k) => values[k] !== '').length + (communitySlug ? 1 : 0)
  const [tab, setTab] = useState<Tab>('for-you')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; trails?: MapTrail[]; error?: string } | null>(null)
  const [neighborhoods, setNeighborhoods] = useState<string[]>([])
  // The trail being pointed at, by its card or its map pin; both get highlighted.
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [mapAvailable, setMapAvailable] = useState(true)
  const navigate = useNavigate()

  // Everything that changes what loadTrails() returns. The search (q) is applied below instead.
  const key = JSON.stringify([values, communityPending ? 'pending' : (communityId ?? ''), attempt])
  const loading = result?.key !== key

  useEffect(() => {
    if (communityPending) return
    let cancelled = false
    const [filterValues, community] = JSON.parse(key) as [Record<FilterKey, string>, string, number]
    loadTrails({ ...toExploreFilters(filterValues), communityId: community || undefined }).then(
      (trails) => !cancelled && setResult({ key, trails }),
      (error: unknown) =>
        !cancelled && setResult({ key, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    )
    return () => {
      cancelled = true
    }
  }, [key, communityPending])

  useEffect(() => {
    let cancelled = false
    // Only fills the neighborhood menu; if it fails the menu just has "Any neighborhood".
    loadNeighborhoods().then(
      (names) => !cancelled && setNeighborhoods(names),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])

  const trails = (result?.trails ?? []).filter((t) => !q || matchesSearch(t, q))
  const ready = tab === 'for-you' && !loading && !result?.error
  // The map shows the same trails as the grid (nothing on the coming-soon tabs).
  const mapTrails = (tab === 'for-you' || tab === 'nearby') && !loading ? trails : []

  // A shared link may name a neighborhood with no trails right now; keep it selectable.
  const neighborhoodNames =
    values.neighborhood && !neighborhoods.includes(values.neighborhood)
      ? [values.neighborhood, ...neighborhoods]
      : neighborhoods
  const neighborhoodOptions = [
    { value: '', label: 'Any neighborhood' },
    ...neighborhoodNames.map((n) => ({ value: n, label: n })),
  ]

  // Filter clicks replace the URL entry, so Back leaves Explore instead of undoing each click.
  const setFilter = (k: FilterKey, value: string) => setParams(withFilter(params, k, value), { replace: true })
  const clearFilters = () => {
    const next = withoutFilters(params)
    next.delete('community')
    setParams(next, { replace: true })
  }
  const setCommunity = (slug: string) => setParams(withFilter(params, 'community', slug), { replace: true })
  const clearSearch = () => setParams(withFilter(params, 'q', ''))

  let body: ReactNode
  if (tab === 'nearby') {
    // Nearby (task G7): the same trails, sorted by distance from you. See ./NearbyPanel.
    body = (
      <NearbyPanel
        trails={loading ? null : trails}
        error={loading ? null : (result?.error ?? null)}
        onRetry={() => setAttempt((n) => n + 1)}
        hoverId={hoverId}
        onHover={setHoverId}
      />
    )
  } else if (tab !== 'for-you') {
    body = (
      <FeedMessage title="Friends is coming soon">
        Trails your friends made, saved or finished.
      </FeedMessage>
    )
  } else if (loading) {
    body = <FeedSkeleton />
  } else if (result?.error) {
    body = (
      <FeedMessage title="Couldn't load trails" picture={false}>
        <p>{result.error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </FeedMessage>
    )
  } else if (trails.length === 0 && !q && activeCount === 0) {
    body = (
      <FeedMessage title="No trails yet">
        <p>Be the first to put one on the map.</p>
        <Link to="/make" className="btn btn--sm mt-4">
          Make a trail
        </Link>
      </FeedMessage>
    )
  } else if (trails.length === 0) {
    body = (
      <FeedMessage title="No trails match">
        <p>
          {q ? `Nothing found for “${q}”` : 'Nothing matches these filters'}
          {q && activeCount > 0 ? ' with these filters.' : '.'}
          {activeCount > 0 ? ' Try turning one off.' : ''}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {q ? (
            <button type="button" className="btn btn--sm btn--secondary" onClick={clearSearch}>
              Clear search
            </button>
          ) : null}
          {activeCount > 0 ? (
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
        onMouseEnter={() => setHoverId(trail.id)}
        onMouseLeave={() => setHoverId(null)}
        onFocus={() => setHoverId(trail.id)}
        onBlur={() => setHoverId(null)}
      >
        <TrailCard trail={trail} selected={hoverId === trail.id} className="h-full" />
      </div>
    ))
  }

  // "3 trails for “pizza” · Clear search" when a search or filter is on (also read out by screen readers).
  const showCount = ready && trails.length > 0 && (q !== '' || activeCount > 0)

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

        <div role="tablist" aria-label="Feed" className="mt-4 flex flex-wrap gap-2 md:mt-5">
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
        {SHOW_COMMUNITIES && tab === 'for-you' ? (
          <div className="mb-4">
            <CommunitySwitcher value={communitySlug} onChange={setCommunity} />
          </div>
        ) : null}

        {tab === 'for-you' ? (
          // Phones: one row you can swipe sideways, so the trails stay near the top. Wider: wraps.
          <div
            role="group"
            aria-label="Filters"
            className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
          >
            <FilterSelect
              label="Category"
              value={values.category}
              options={CATEGORY_OPTIONS}
              onChange={(v) => setFilter('category', v)}
            />
            <FilterSelect
              label="Neighborhood"
              value={values.neighborhood}
              options={neighborhoodOptions}
              onChange={(v) => setFilter('neighborhood', v)}
            />
            <FilterSelect label="Cost" value={values.cost} options={COST_OPTIONS} onChange={(v) => setFilter('cost', v)} />
            <FilterSelect
              label="Length"
              value={values.length}
              options={LENGTH_OPTIONS}
              onChange={(v) => setFilter('length', v)}
            />
            <FilterToggle
              label="Late night"
              icon={<Moon aria-hidden />}
              on={values.late === '1'}
              title="At least one stop is open late"
              onChange={(on) => setFilter('late', on ? '1' : '')}
            />
            <FilterToggle
              label="Near a T station"
              icon={<TrainFront aria-hidden />}
              on={values.near_t === '1'}
              title={`Every stop is within ${NEAR_T_MILES} mi of a T station (straight line)`}
              onChange={(on) => setFilter('near_t', on ? '1' : '')}
            />
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 cursor-pointer items-center rounded-pill border-0 bg-transparent px-2 text-sm font-semibold text-crumb-strong hover:text-crumb-deep hover:underline md:h-[38px]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        <p role="status" className={cn('mt-4 text-sm text-muted-foreground', showCount ? 'mb-3' : 'sr-only')}>
          {ready ? (
            <>
              {trails.length} {trails.length === 1 ? 'trail' : 'trails'}
              {q ? ` for “${q}”` : ''}
              {showCount && q ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:text-crumb-deep hover:underline"
                  >
                    Clear search
                  </button>
                </>
              ) : null}
              {/* Phones: the filter row scrolls, so an active filter may be out of sight. */}
              {showCount && activeCount > 0 ? (
                <span className="md:hidden">
                  {' · '}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-crumb-strong hover:text-crumb-deep hover:underline"
                  >
                    Clear {activeCount} {activeCount === 1 ? 'filter' : 'filters'}
                  </button>
                </span>
              ) : null}
            </>
          ) : null}
        </p>

        <div
          id="feed-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          aria-busy={tab === 'for-you' && loading}
          className={cn(
            'grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3 md:gap-4',
            !showCount && 'mt-4',
          )}
        >
          {body}
        </div>
      </section>

      <aside aria-label="Trails on the map" className="sticky top-24 hidden lg:block">
        <TrailsMap
          trails={mapTrails}
          highlightedId={hoverId}
          onHover={setHoverId}
          onSelect={(id) => navigate(`/trails/${id}`)}
          onStatusChange={(status) => setMapAvailable(status !== 'unavailable')}
          className="aspect-[440/600] max-h-[calc(100dvh-160px)] w-full"
        />
        {mapAvailable && mapTrails.length > 0 ? <TrailsMapLegend trails={mapTrails} className="mt-3" /> : null}
      </aside>
    </div>
  )
}
