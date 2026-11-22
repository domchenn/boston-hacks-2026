/**
 * Map tab: every published trail you can see on a full-screen map (TrailsMap, one
 * pin per trail start, coloured by T line), not just a personalised feed. The same
 * filters as Explore (TrailFilters: category, neighborhood, cost, length, late
 * night, near a T) narrow both the pins and the cards; they live in the URL, so a
 * filtered map can be shared and survives refresh. Trails with no mapped stop still
 * get a card. Desktop: a scrolling list of TrailCards on the left;
 * hovering a card highlights its pin. Phones: a swipeable card rail above the tab
 * bar; the card in the middle is highlighted and the map pans to it. Tapping a pin
 * brings its card into view. Data: loadTrails() from the Explore lane's api.
 * Route: /map · Owner: Jason
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { TrailCard } from '@/components/TrailCard'
import { TrailsMap, TrailsMapLegend } from '@/components/TrailsMap'
import { loadTrails, matchesSearch, type MapTrail } from '@/features/explore/api'
import { activeFilterCount, readFilterValues, toExploreFilters, withoutFilters } from '@/features/explore/filters'
import { TrailFilters } from '@/features/explore/TrailFilters'

const PHONE_QUERY = '(max-width: 767px)'

/** True below the md breakpoint, kept in sync with the window size. */
function useIsPhone() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(PHONE_QUERY)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(PHONE_QUERY).matches,
  )
}

/** A card-sized message (loading, error, empty) that fits both the rail and the list. */
function RailMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <li className="w-[86%] max-w-[340px] shrink-0 snap-center rounded-card border border-line bg-white px-5 py-6 text-center shadow-[var(--shadow-float)] md:w-auto md:max-w-none md:shadow-none">
      <p className="text-lg font-bold">{title}</p>
      {children ? <div className="mt-1.5 text-base text-ink-2">{children}</div> : null}
    </li>
  )
}

export function MapPage() {
  const isPhone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const filterKey = JSON.stringify(readFilterValues(params))
  const activeCount = activeFilterCount(params)
  const railRef = useRef<HTMLUListElement>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; trails?: MapTrail[]; error?: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [mapAvailable, setMapAvailable] = useState(true)

  // Everything that changes what loadTrails() returns; the header search (q) is applied below.
  const key = `${filterKey}:${attempt}`
  const loading = result?.key !== key
  const trails = !loading ? (result?.trails ?? []).filter((t) => !q || matchesSearch(t, q)) : []

  useEffect(() => {
    let cancelled = false
    loadTrails(toExploreFilters(JSON.parse(filterKey))).then(
      (list) => !cancelled && setResult({ key, trails: list }),
      (error: unknown) =>
        !cancelled && setResult({ key, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    )
    return () => {
      cancelled = true
    }
  }, [key, filterKey])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  // On phones the middle card is always "selected" (the first one until you swipe).
  const selected = selectedId && trails.some((t) => t.id === selectedId) ? selectedId : isPhone ? (trails[0]?.id ?? null) : null
  const highlighted = isPhone ? selected : (hoverId ?? selected)

  /** Phones: once the rail stops moving, select the card closest to its middle. */
  const onRailScroll = useCallback(() => {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const rail = railRef.current
      if (!rail || !window.matchMedia(PHONE_QUERY).matches) return
      const middle = rail.getBoundingClientRect().left + rail.clientWidth / 2
      let best: { id: string; distance: number } | null = null
      for (const item of rail.querySelectorAll<HTMLElement>('[data-trail-id]')) {
        const box = item.getBoundingClientRect()
        const distance = Math.abs(box.left + box.width / 2 - middle)
        if (!best || distance < best.distance) best = { id: item.dataset.trailId!, distance }
      }
      if (best) setSelectedId(best.id)
    }, 120)
  }, [])

  /** Pin tapped: select its trail and bring the card into view (rail or list). */
  const selectFromMap = useCallback((id: string) => {
    setSelectedId(id)
    railRef.current
      ?.querySelector(`[data-trail-id="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [])

  let items: ReactNode
  if (loading) {
    items = [0, 1].map((i) => (
      <li
        key={i}
        aria-hidden
        className="h-[196px] w-[86%] max-w-[340px] shrink-0 animate-pulse rounded-card border border-line bg-sand md:w-auto md:max-w-none"
      />
    ))
  } else if (result?.error) {
    items = (
      <RailMessage title="Couldn't load trails">
        <p>{result.error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-3" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </RailMessage>
    )
  } else if (trails.length === 0 && (activeCount > 0 || q)) {
    items = (
      <RailMessage title="No trails match">
        <p>{q ? `Nothing found for “${q}” with these filters.` : 'Nothing matches these filters.'}</p>
        {activeCount > 0 ? (
          <button
            type="button"
            className="btn btn--sm btn--secondary mt-3"
            onClick={() => setParams(withoutFilters(params), { replace: true })}
          >
            Clear filters
          </button>
        ) : null}
      </RailMessage>
    )
  } else if (trails.length === 0) {
    items = (
      <RailMessage title="No trails yet">
        <p>Be the first to put one on the map.</p>
        <Link to="/make" className="btn btn--sm mt-3">
          Make a trail
        </Link>
      </RailMessage>
    )
  } else {
    items = trails.map((trail) => (
      <li
        key={trail.id}
        data-trail-id={trail.id}
        className="w-[86%] max-w-[340px] shrink-0 snap-center rounded-card shadow-[var(--shadow-float)] md:w-auto md:max-w-none md:shadow-none"
        onMouseEnter={() => setHoverId(trail.id)}
        onMouseLeave={() => setHoverId(null)}
        onFocus={() => setHoverId(trail.id)}
        onBlur={() => setHoverId(null)}
      >
        <TrailCard trail={trail} selected={highlighted === trail.id} className="h-full" />
      </li>
    ))
  }

  return (
    <div className="relative flex min-h-0 flex-1 md:flex-row-reverse">
      <TrailsMap
        trails={trails}
        highlightedId={highlighted}
        onHover={isPhone ? undefined : setHoverId}
        onSelect={selectFromMap}
        followHighlight={isPhone}
        gestureHandling="greedy"
        controls={isPhone ? 'middle' : 'bottom'}
        onStatusChange={(status) => setMapAvailable(status !== 'unavailable')}
        padding={isPhone ? { top: 80, right: 48, bottom: 250, left: 40 } : { top: 56, right: 56, bottom: 56, left: 56 }}
        className="absolute inset-0 rounded-none border-0 md:relative md:inset-auto md:min-w-0 md:flex-1"
      />

      {/* Phones: the filters float over the top of the map, scrolling sideways (z-40 so their sheets cover the card rail). */}
      <div className="absolute inset-x-0 top-0 z-40 md:hidden">
        <TrailFilters params={params} setParams={setParams} className="px-4 pt-3 pb-2" />
      </div>

      <section
        aria-label="Trails on the map"
        className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom,0px))] z-10 md:pointer-events-auto md:static md:w-[400px] md:shrink-0 md:overflow-y-auto md:border-r md:border-line md:bg-paper"
      >
        {/* Visible heading and legend on desktop; phones get the rail only. */}
        <h1 className="hidden px-5 pt-6 text-2xl font-extrabold tracking-[var(--tracking-title)] md:block">
          Trails on the map
        </h1>
        <h1 className="sr-only md:hidden">Trails on the map</h1>
        <TrailFilters params={params} setParams={setParams} className="mt-3 hidden px-5 md:flex" />
        <p role="status" className="sr-only">
          {loading ? 'Loading trails…' : `${trails.length} ${trails.length === 1 ? 'trail' : 'trails'}`}
          {!loading && activeCount > 0 ? ' match these filters' : ''}
        </p>
        {mapAvailable && !loading && trails.length > 0 ? <TrailsMapLegend trails={trails} className="mt-2 hidden px-5 md:flex" /> : null}
        <ul
          ref={railRef}
          onScroll={onRailScroll}
          aria-busy={loading}
          className="pointer-events-auto m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-7 [scrollbar-width:none] md:flex-col md:snap-none md:overflow-visible md:p-5 [&::-webkit-scrollbar]:hidden"
        >
          {items}
        </ul>
      </section>
    </div>
  )
}
