/**
 * Map of a trail: numbered stop markers (.num-ring) and the real walking /
 * transit / biking route between stops from the Google Directions service, drawn
 * as the style guide's dotted orange line. In "live" mode it also shows the
 * user's position (passed in by the page, never stored) and keeps it in view.
 *
 * Falls back to a list of stops with "Open in Google Maps" links when there's
 * no API key, Google fails to load, or no stop has coordinates. A leg with no
 * route gets no line: we never draw straight lines as if they were routes
 * (PRD §5.5). Used by Trail detail, Active trail, Make a trail and the Map tab.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, MapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BOSTON_CENTER,
  MAP_STYLE,
  getTrailDirectionsLink,
  googleTravelMode,
  loadGoogleMaps,
  type LatLng,
} from '@/lib/maps'
import type { TravelMode } from '@/types/db-values'

export type RouteMapStop = {
  id: string
  placeName: string
  latitude: number | null
  longitude: number | null
  /** How to get here from the previous stop. Null for the first stop. */
  travelModeToStop: TravelMode | null
}

export type RouteMapProps = {
  stops: RouteMapStop[]
  /** "preview": static overview. "live": follows the user during an active trail. */
  mode?: 'preview' | 'live'
  /** The user's current position (live mode only). Never stored. */
  userLocation?: { latitude: number; longitude: number } | null
  /** Highlight one stop, e.g. the next stop on an active trail. */
  selectedStopId?: string | null
  onSelectStop?: (stopId: string) => void
  className?: string
}

const TRAIL_COLOR = '#E8552D' // --color-crumb: trail dots and rings only

/** Directions results reused across renders and pages (keyed by from|to|mode). */
const legCache = new Map<string, google.maps.LatLng[] | null>()

const toLatLng = (s: RouteMapStop): LatLng | null =>
  s.latitude !== null && s.longitude !== null ? { lat: s.latitude, lng: s.longitude } : null

type HtmlMarker = google.maps.OverlayView & { element: HTMLElement; setPosition(p: LatLng): void }

/** A map overlay that positions an HTML element (so markers can use our CSS classes). */
function createHtmlMarker(maps: typeof google.maps, position: LatLng, element: HTMLElement): HtmlMarker {
  class Marker extends maps.OverlayView {
    element = element
    private position = position
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.element)
    }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(this.position))
      if (!point) return
      this.element.style.position = 'absolute'
      this.element.style.left = `${point.x}px`
      this.element.style.top = `${point.y}px`
      this.element.style.transform = 'translate(-50%, -50%)'
    }
    onRemove() {
      this.element.remove()
    }
    setPosition(p: LatLng) {
      this.position = p
      this.draw()
    }
  }
  return new Marker()
}

/** Dotted polyline per the style guide: invisible stroke + repeated circles. */
function dottedLine(maps: typeof google.maps, map: google.maps.Map, path: google.maps.LatLng[]) {
  return new maps.Polyline({
    map,
    path,
    strokeOpacity: 0,
    clickable: false,
    icons: [
      {
        icon: { path: maps.SymbolPath.CIRCLE, scale: 1.8, fillColor: TRAIL_COLOR, fillOpacity: 1, strokeOpacity: 0 },
        offset: '0',
        repeat: '9px',
      },
    ],
  })
}

/** The route for one leg from the Directions service, or null if there isn't one. */
async function routeForLeg(maps: typeof google.maps, from: LatLng, to: LatLng, mode: TravelMode | null) {
  const key = `${from.lat},${from.lng}|${to.lat},${to.lng}|${googleTravelMode(mode)}`
  if (legCache.has(key)) return legCache.get(key) ?? null
  const travelMode = { walking: maps.TravelMode.WALKING, transit: maps.TravelMode.TRANSIT, bicycling: maps.TravelMode.BICYCLING }[
    googleTravelMode(mode)
  ]
  try {
    const result = await new maps.DirectionsService().route({ origin: from, destination: to, travelMode })
    const path = result.routes[0]?.overview_path ?? null
    legCache.set(key, path)
    return path
  } catch {
    legCache.set(key, null) // no route, quota, or Directions API not enabled
    return null
  }
}

export function RouteMap({ stops, mode = 'preview', userLocation, selectedStopId, onSelectStop, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapsRef = useRef<typeof google.maps | null>(null)
  const markersRef = useRef(new Map<string, HtmlMarker>())
  const userMarkerRef = useRef<HtmlMarker | null>(null)
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null)
  const onSelectRef = useRef(onSelectStop)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [missingLegs, setMissingLegs] = useState(0)

  useEffect(() => {
    onSelectRef.current = onSelectStop
  }, [onSelectStop])

  const placed = useMemo(() => stops.filter((s) => toLatLng(s) !== null), [stops])
  // Re-draw only when what's on the map actually changes.
  const stopsKey = placed.map((s) => `${s.id}:${s.latitude},${s.longitude}:${s.travelModeToStop}`).join('|')
  const trailLink = getTrailDirectionsLink(
    stops.map((s) => toLatLng(s) ?? s.placeName).filter((p): p is LatLng | string => Boolean(p)),
  )

  // 1. Load Google Maps and create the map once.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        mapsRef.current = maps
        mapRef.current = new maps.Map(containerRef.current, {
          center: BOSTON_CENTER,
          zoom: 14,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: 'cooperative',
        })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 2. Stop markers + route lines, re-drawn when the stops change.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (status !== 'ready' || !maps || !map) return
    let cancelled = false
    const markers = markersRef.current
    const lines: google.maps.Polyline[] = []

    const bounds = new maps.LatLngBounds()
    placed.forEach((stop) => {
      const position = toLatLng(stop)!
      const number = stops.findIndex((s) => s.id === stop.id) + 1
      bounds.extend(position)
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'num-ring num-ring--map'
      el.textContent = String(number)
      el.setAttribute('aria-label', `Stop ${number}: ${stop.placeName}`)
      el.style.cursor = 'pointer'
      el.style.padding = '0'
      el.addEventListener('click', () => onSelectRef.current?.(stop.id))
      const marker = createHtmlMarker(maps, position, el)
      marker.setMap(map)
      markers.set(stop.id, marker)
    })
    boundsRef.current = bounds
    if (placed.length === 1) {
      map.setCenter(bounds.getCenter())
      map.setZoom(16)
    } else if (placed.length > 1) {
      map.fitBounds(bounds, 48)
    }

    // Route legs between consecutive stops that both have coordinates.
    const legs = placed.slice(1).map((stop, i) => ({ from: toLatLng(placed[i])!, to: toLatLng(stop)!, mode: stop.travelModeToStop }))
    Promise.all(legs.map((leg) => routeForLeg(maps, leg.from, leg.to, leg.mode))).then((paths) => {
      if (cancelled) return
      paths.forEach((path) => {
        if (path) lines.push(dottedLine(maps, map, path))
      })
      setMissingLegs(paths.filter((p) => p === null).length)
    })

    return () => {
      cancelled = true
      markers.forEach((m) => m.setMap(null))
      markers.clear()
      lines.forEach((l) => l.setMap(null))
    }
    // stopsKey captures the parts of `stops` that matter for drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stopsKey])

  // 3. Highlight the selected stop.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => marker.element.classList.toggle('num-ring--current', id === selectedStopId))
  }, [selectedStopId, status, stopsKey])

  // 4. The user's position (live mode): a blue dot, kept in view.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (status !== 'ready' || !maps || !map || mode !== 'live' || !userLocation) {
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      return
    }
    const position = { lat: userLocation.latitude, lng: userLocation.longitude }
    if (!userMarkerRef.current) {
      const dot = document.createElement('span')
      dot.setAttribute('aria-label', 'You are here')
      dot.style.cssText =
        'display:block;width:18px;height:18px;border-radius:50%;background:#1D4ED8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(29,78,216,.18)'
      userMarkerRef.current = createHtmlMarker(maps, position, dot)
      userMarkerRef.current.setMap(map)
      const bounds = boundsRef.current ? new maps.LatLngBounds(boundsRef.current.getSouthWest(), boundsRef.current.getNorthEast()) : new maps.LatLngBounds()
      bounds.extend(position)
      map.fitBounds(bounds, 48)
    } else {
      userMarkerRef.current.setPosition(position)
      if (!map.getBounds()?.contains(position)) map.panTo(position)
    }
  }, [status, mode, userLocation])

  if (status === 'unavailable' || (status === 'ready' && placed.length === 0)) {
    return <RouteMapFallback stops={stops} trailLink={trailLink} className={className} />
  }

  return (
    <div className={cn('relative overflow-hidden rounded-card border border-line bg-sand', className)}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Map of the trail" role="region" />
      {status === 'loading' ? <div className="absolute inset-0 animate-pulse bg-sand" aria-hidden /> : null}
      {status === 'ready' && missingLegs > 0 && trailLink ? (
        <a
          href={trailLink}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-[var(--shadow-float)]"
        >
          Directions in Google Maps
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      ) : null}
    </div>
  )
}

/** Shown without a map: the stops in order with a Google Maps link for the whole trail. */
function RouteMapFallback({ stops, trailLink, className }: { stops: RouteMapStop[]; trailLink: string | null; className?: string }) {
  return (
    <div className={cn('flex flex-col justify-center rounded-card border border-line bg-sand p-5', className)}>
      <div className="flex items-center gap-2 text-ink">
        <MapIcon aria-hidden className="size-5 text-muted-foreground" />
        <p className="font-bold">The route</p>
      </div>
      {stops.length ? (
        <ol className="mt-3 flex flex-col gap-2">
          {stops.map((stop, i) => (
            <li key={stop.id} className="flex items-center gap-2.5 text-sm text-ink">
              <span className="num-ring shrink-0" aria-hidden>
                {i + 1}
              </span>
              <span className="truncate">{stop.placeName}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Add stops to see the route.</p>
      )}
      {trailLink ? (
        <a
          href={trailLink}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-crumb-strong hover:text-crumb-deep"
        >
          Open directions in Google Maps
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      ) : null}
    </div>
  )
}
