/**
 * Nearby tab: "Within 2 mi" slider. Drag (or use the arrow keys) to show only
 * trails whose first stop is within that distance of you; the far right is "Any
 * distance". Snaps to a few friendly steps. The value lives in Explore's URL
 * (?radius=), so it survives refresh. Steps and parsing: ./nearby (RADIUS_STEPS).
 */

import { useId, useState } from 'react'
import { RADIUS_STEPS, radiusLabel } from './nearby'

export function RadiusSlider({ value, onChange }: { value: number | null; onChange: (miles: number | null) => void }) {
  const id = useId()
  // The slider follows your finger right away; the URL catches up a moment later.
  const [shown, setShown] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    // Changed from outside (e.g. "Show any distance"): jump there.
    setLastValue(value)
    setShown(value)
  }
  // Positions 0..n-1 are the steps; the last position is "Any distance".
  const any = RADIUS_STEPS.length
  const index = shown === null ? any : Math.max(0, RADIUS_STEPS.indexOf(shown))
  const label = radiusLabel(shown)
  return (
    <div className="col-span-full flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
      <label htmlFor={id} className="w-32 flex-none text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={any}
        step={1}
        value={index}
        aria-valuetext={label}
        onChange={(e) => {
          const i = Number(e.target.value)
          const miles = i >= any ? null : RADIUS_STEPS[i]
          setShown(miles)
          onChange(miles)
        }}
        className="h-6 min-w-0 flex-1 cursor-pointer accent-[var(--color-crumb-strong)]"
      />
    </div>
  )
}
