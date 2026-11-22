/**
 * Map of many trails (Explore's right column and the Map tab): one pin per trail at
 * its first stop, ringed in the trail's main T line colour, with the trail name on
 * hover or when highlighted (e.g. while its card is hovered). Pins only mark where a
 * trail starts; no routes are drawn here. Loads Google Maps via @/lib/maps; without
 * it (no key, blocked script) shows a quiet note instead. TrailsMapLegend lists the
 * lines on the map. Used by ExplorePage and MapPage.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MapIcon } from 'lucide-react'
import { LINE_INFO, lineColor } from '@/components/trailFormat'
import { BOSTON_CENTER, MAP_STYLE, loadGoogleMaps, type LatLng } from '@/lib/maps'
import { cn } from '@/lib/utils'
import type { TransitLine } from '@/types/db-values'

export type TrailPin = {
  id: string
  title: string
  primaryLine: TransitLine | null
  /** First stop with coordinates; trails without one get no pin. */
  start: LatLng | null
}

type Padding = { top: number; right: number; bottom: number; left: number }

type TrailsMapProps = {
  trails: TrailPin[]
  /** The pin to show as selected (bigger, filled, name visible). */
  highlightedId?: string | null
  /** Pin hovered or focused (id) or left (null). */
  onHover?: (id: string | null) => void
  /** Pin clicked or tapped. */
  onSelect: (id: string) => void
  /** Pan to the highlighted pin whenever it changes (Map tab card rail). */
  followHighlight?: boolean
  /** Space to keep clear around the pins, e.g. under a card rail. */
  padding?: Padding
  /** "greedy" for a full-screen map; "cooperative" when the page scrolls past it. */
  gestureHandling?: 'cooperative' | 'greedy'
  /** Where the zoom buttons go; "top" keeps them clear of a bottom card rail. */
  controls?: 'top' | 'middle' | 'bottom'
  /** Told when the map becomes ready or turns out to be unavailable (e.g. to hide a legend). */
  onStatusChange?: (status: 'loading' | 'ready' | 'unavailable') => void
  className?: string
}

type PinOverlay = google.maps.OverlayView & { element: HTMLButtonElement; position: LatLng }

/** An overlay that keeps an HTML pin (styled with our classes) at a position. */
function createPinOverlay(maps: typeof google.maps, position: LatLng, element: HTMLButtonElement): PinOverlay {
  class Pin extends maps.OverlayView {
    element = element
    position = position
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.element)
    }
    draw() {
      const projection = this.getProjection()
      const latLng = new maps.LatLng(this.position)
      const point = projection?.fromLatLngToDivPixel(latLng)
      if (!point) return
      this.element.style.left = `${point.x}px`
      this.element.style.top = `${point.y}px`
      // Put the name on the left for pins near the right edge so it isn't cut off.
      const onScreen = projection.fromLatLngToContainerPixel(latLng)
      const width = (this.getMap() as google.maps.Map | null)?.getDiv().clientWidth ?? 0
      this.element.dataset.side = onScreen && width && onScreen.x > width * 0.55 ? 'left' : 'right'
    }
    onRemove() {
      this.element.remove()
    }
  }
  return new Pin()
}

/** Builds one pin: a 44 px tap area with a ring in the line colour and a name label. */
function pinElement(trail: TrailPin) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'group absolute size-0 cursor-pointer border-0 bg-transparent p-0 outline-none'
  button.style.setProperty('--pin', lineColor(trail.primaryLine))
  button.setAttribute('aria-label', `${trail.title}, starts here`)
  button.innerHTML = `
    <span class="absolute top-0 left-0 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full group-focus-visible:shadow-[var(--focus-ring)]">
      <span class="block size-4 rounded-full border-[3px] border-[color:var(--pin)] bg-white shadow-[var(--shadow-float)] transition-all duration-150 group-hover:size-5 group-data-[active=true]:size-6 group-data-[active=true]:border-white group-data-[active=true]:bg-[color:var(--pin)]"></span>
    </span>
    <span class="pointer-events-none absolute top-0 left-3.5 -translate-y-1/2 rounded-pill bg-white px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-ink opacity-0 shadow-[var(--shadow-float)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[active=true]:left-4.5 group-data-[active=true]:opacity-100 group-data-[side=left]:right-3.5 group-data-[side=left]:left-auto group-data-[active=true]:group-data-[side=left]:right-4.5 group-data-[active=true]:group-data-[side=left]:left-auto"></span>`
  button.lastElementChild!.textContent = trail.title
  return button
}

export function TrailsMap({
  trails,
  highlightedId = null,
  onHover,
  onSelect,
  followHighlight = false,
  padding = { top: 48, right: 48, bottom: 48, left: 48 },
  gestureHandling = 'cooperative',
  controls = 'bottom',
  onStatusChange,
  className,
}: TrailsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapsRef = useRef<typeof google.maps | null>(null)
  const pinsRef = useRef(new Map<string, PinOverlay>())
  const callbacks = useRef({ onHover, onSelect })
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    callbacks.current = { onHover, onSelect }
  }, [onHover, onSelect])

  useEffect(() => {
    onStatusChange?.(status)
    // Report changes of status only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const placed = useMemo(() => trails.filter((t) => t.start !== null), [trails])
  // Redraw pins only when what's on the map changes, not on every parent render.
  const pinsKey = placed.map((t) => `${t.id}:${t.start!.lat},${t.start!.lng}:${t.primaryLine}`).join('|')
  const paddingKey = `${padding.top},${padding.right},${padding.bottom},${padding.left}`

  // 1. Load Google Maps and create the map once.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return
        mapsRef.current = maps
        mapRef.current = new maps.Map(containerRef.current, {
          center: BOSTON_CENTER,
          zoom: 12,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position:
              controls === 'top'
                ? maps.ControlPosition.RIGHT_TOP
                : controls === 'middle'
                  ? maps.ControlPosition.RIGHT_CENTER
                  : maps.ControlPosition.RIGHT_BOTTOM,
          },
          clickableIcons: false,
          gestureHandling,
        })
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('unavailable'))
    return () => {
      cancelled = true
    }
    // gestureHandling and controls are fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. One pin per trail; fit the map to them.
  useEffect(() => {
    const maps = mapsRef.current
    const map = mapRef.current
    if (status !== 'ready' || !maps || !map) return
    const pins = pinsRef.current
    const bounds = new maps.LatLngBounds()
    placed.forEach((trail) => {
      const element = pinElement(trail)
      element.addEventListener('click', () => callbacks.current.onSelect(trail.id))
      element.addEventListener('mouseenter', () => callbacks.current.onHover?.(trail.id))
      element.addEventListener('mouseleave', () => callbacks.current.onHover?.(null))
      element.addEventListener('focus', () => callbacks.current.onHover?.(trail.id))
      element.addEventListener('blur', () => callbacks.current.onHover?.(null))
      const pin = createPinOverlay(maps, trail.start!, element)
      pin.setMap(map)
      pins.set(trail.id, pin)
      bounds.extend(trail.start!)
    })
    if (placed.length === 1) {
      map.setCenter(placed[0].start!)
      map.setZoom(15)
    } else if (placed.length > 1) {
      map.fitBounds(bounds, padding)
    }
    return () => {
      pins.forEach((pin) => pin.setMap(null))
      pins.clear()
    }
    // pinsKey / paddingKey capture what matters in `placed` and `padding`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pinsKey, paddingKey])

  // 3. Highlight one pin (and bring it to the front); optionally pan to it.
  useEffect(() => {
    pinsRef.current.forEach((pin, id) => {
      const active = id === highlightedId
      pin.element.dataset.active = String(active)
      pin.element.style.zIndex = active ? '10' : ''
    })
    const map = mapRef.current
    const pin = highlightedId ? pinsRef.current.get(highlightedId) : undefined
    if (!followHighlight || !map || !pin) return
    map.panTo(pin.position)
    // Centre the pin in the part of the map that isn't covered (e.g. by a card rail).
    map.panBy((padding.right - padding.left) / 2, (padding.bottom - padding.top) / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedId, followHighlight, status, pinsKey])

  if (status === 'unavailable') {
    return (
      <div className={cn('grid place-items-center rounded-card border border-line bg-sand p-8 text-center', className)}>
        <div>
          <MapIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-bold text-ink">Map unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">Google Maps didn't load. Every trail is still in the list.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-card border border-line bg-sand', className)}>
      <div ref={containerRef} className="absolute inset-0" role="region" aria-label="Map of trail starting points" />
      {status === 'loading' ? <div className="absolute inset-0 animate-pulse bg-sand" aria-hidden /> : null}
    </div>
  )
}

/** "3 trails on the map" plus a dot for each T line the pins use. */
export function TrailsMapLegend({ trails, className }: { trails: TrailPin[]; className?: string }) {
  const placed = trails.filter((t) => t.start !== null)
  const lines = [...new Set(placed.map((t) => (t.primaryLine && LINE_INFO[t.primaryLine].color ? t.primaryLine : null)))]
  const missing = trails.length - placed.length
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted-foreground', className)}>
      <span>
        {placed.length} {placed.length === 1 ? 'trail' : 'trails'} on the map
        {missing > 0 ? ` · ${missing} without a location` : ''}
      </span>
      {lines.length > 0 ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {lines.map((line) => (
            <span key={line ?? 'none'} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-full border-[2.5px] border-[color:var(--pin)] bg-white"
                style={{ '--pin': lineColor(line) } as CSSProperties}
              />
              {line ? LINE_INFO[line].name : 'Other'}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  )
}
