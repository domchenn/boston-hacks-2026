/**
 * "Stop by stop, crumb by crumb." (#trails): an example trail on an illustrated map.
 * The map art (assets/trail-map.svg) is laid back with CSS 3D transforms; the stop
 * markers, labels and leg pills sit on top in % of a fixed-ratio box so they line up
 * at any width. A trail card overlaps the top right and drops below the map under
 * 760 px. The dotted route is drawn over the art here so that, when the map scrolls
 * into view (useRevealOnView), it walks from stop to stop and each stop pops up as
 * the trail reaches it. On phones (map under 520 px) labels shrink to just the stop
 * name. Styled by .lp-map* in landing.css. Used by LandingPage.
 */

import { useId, useRef } from 'react'
import { MapPin, Star } from 'lucide-react'
import trailMap from './assets/trail-map.svg'
import { useRevealOnView } from './useRevealOnView'

/**
 * Marker positions in % of the map box, matched to ROUTE below. `order` (--at) is when
 * the trail reaches the stop. `labelShift` keeps the last label inside a phone-width map
 * by lining its right edge up with the ring instead of centering it.
 */
const STOPS = [
  { n: 1, labelShift: '', order: '[--at:0.15s]', name: 'Tatte', crumb: 'Crumb: grab a latte to go', pos: 'left-[18.48%] top-[43.18%]', ring: 'border-crumb' },
  { n: 2, labelShift: '', order: '[--at:1.2s]', name: 'Public Garden', crumb: 'Crumb: find the Make Way for Ducklings statues', pos: 'left-[45.23%] top-[52.94%]', ring: 'border-crumb' },
  { n: 3, labelShift: '@max-[520px]:translate-x-[calc(-50%+17px)]', order: '[--at:2.55s]', name: 'Boston Public Library', crumb: 'Crumb: find a seat, start studying', pos: 'left-[85.99%] top-[67.17%]', ring: 'border-[var(--line-green)]' },
]

/**
 * The trail's legs in trail-map.svg's coordinates (viewBox 1400 × 1000), drawn one
 * after the other: `timing` is when each starts (--from) and how long it takes (--for),
 * timed to end as the next stop pops (see STOPS' --at).
 */
const ROUTE = [
  { d: 'M360 330 V420 H640 V520', color: 'stroke-crumb', timing: '[--from:0.45s] [--for:0.8s]' },
  { d: 'M640 520 V620 H880 V770 H1020', color: 'stroke-[var(--line-green)]', timing: '[--from:1.55s] [--for:1.05s]' },
]

const LEGS = [
  { dot: 'bg-crumb', label: 'Walk · 6 min' },
  { dot: 'bg-[var(--line-green)]', label: 'Green Line, Arlington → Copley · 4 min' },
]

export function TrailMapSection() {
  const mapRef = useRef<HTMLDivElement>(null)
  // useId can contain characters that break url(#…) references; keep it to safe ones.
  const maskId = `lp-route${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  useRevealOnView(mapRef, { animateClass: 'lp-map--animate' })

  return (
    <section id="trails" className="lp-map-section overflow-hidden border-y border-line pt-28 pb-24 sm:pt-40 sm:pb-[120px]">
      <div className="mx-auto flex max-w-[1264px] flex-col items-start gap-5 px-5 text-left sm:px-8">
        <h2 className="m-0 text-[clamp(36px,5vw,60px)] leading-[1.02] font-extrabold tracking-[-0.045em]">
          Stop by stop,
          <br />
          crumb by crumb.
        </h2>
        <p className="m-0 max-w-[44ch] text-[17px] leading-[1.6] text-ink-2">
          Manage your trail all in the app. Start a trail and view the route on the map, every stop in order, and the crumbs
          waiting along the way.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-[1264px] px-5 sm:px-8">
        <div className="lp-map-wrap">
          <div
            role="img"
            aria-label="Map of the Finals Week Study Sesh trail: walk from Tatte on Charles St to the Public Garden, then take the Green Line from Arlington to Copley for the Boston Public Library"
            className="lp-map"
            ref={mapRef}
          >
            <div className="lp-map__plane">
              <img src={trailMap} alt="" />
              <svg viewBox="0 0 1400 1000" aria-hidden className="lp-map__route">
                <defs>
                  {ROUTE.map((leg, i) => (
                    <mask key={leg.d} id={`${maskId}-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1400" height="1000">
                      <path d={leg.d} pathLength={1} className={`lp-map__route-pen ${leg.timing}`} />
                    </mask>
                  ))}
                </defs>
                {ROUTE.map((leg, i) => (
                  <path key={leg.d} d={leg.d} mask={`url(#${maskId}-${i})`} className={`lp-map__route-dots ${leg.color}`} />
                ))}
              </svg>
            </div>
            <div aria-hidden className="lp-map__fade lp-map__fade--y" />
            <div aria-hidden className="lp-map__fade lp-map__fade--x" />

            {STOPS.map((stop) => (
              <div key={stop.n} className={`lp-map__stop ${stop.pos} ${stop.order} @max-[520px]:gap-1`}>
                <div
                  className={`lp-map__label gap-0.5 rounded-[14px] border border-line bg-white px-3 py-2 text-left whitespace-nowrap shadow-[0_8px_24px_rgba(27,25,22,0.10)] @max-[520px]:rounded-[10px] @max-[520px]:px-2 @max-[520px]:py-1 ${stop.labelShift}`}
                >
                  <span className="text-[14px] font-bold @max-[520px]:text-[11px]">{stop.name}</span>
                  <span className="lp-map__crumb text-[12px] text-muted-foreground">{stop.crumb}</span>
                </div>
                <span className={`lp-map__ring ${stop.ring}`}>{stop.n}</span>
              </div>
            ))}

            <div className="absolute bottom-[5%] left-[3%] z-[2] flex flex-wrap gap-2">
              {LEGS.map((leg) => (
                <span
                  key={leg.label}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2"
                >
                  <span className={`size-[9px] rounded-full ${leg.dot}`} />
                  {leg.label}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-map__card flex flex-col gap-4 rounded-[var(--radius-sheet)] border border-line bg-white p-6 text-left shadow-[0_2px_4px_rgba(27,25,22,0.04),0_24px_48px_rgba(27,25,22,0.12)]">
            <span className="text-[16px]">
              <span className="font-semibold text-crumb-strong">Cafés</span>
              <span className="text-muted-foreground"> · Back Bay</span>
            </span>
            <span className="-mt-1.5 text-[27px] leading-[1.15] font-extrabold tracking-[-0.03em]">Finals Week Study Sesh</span>
            <span className="inline-flex items-center gap-1.5 text-[17px] text-muted-foreground">
              <MapPin aria-hidden className="size-[18px]" />
              Tatte
            </span>
            <span className="inline-flex items-center gap-1.5 text-[17px] font-semibold">
              ~$8 · 2 hr · 3 crumbs ·
              <Star aria-hidden strokeWidth={0} className="size-[19px] fill-ink" />
              4.6
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
