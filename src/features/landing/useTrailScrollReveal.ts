/**
 * Scroll reveal for How it works. A "pen" sits 60% down the viewport: each dotted
 * line shows whole dots up to the pen (--lp-draw-px), and a step's number pops in
 * once the pen reaches it (.is-reached). A step's text and snippet rise in the first
 * time it scrolls into view (.is-in). Styles live in landing.css; skipped under
 * prefers-reduced-motion. Used by HowItWorks.
 */

import { useLayoutEffect, type RefObject } from 'react'

/** Where the pen sits, as a share of the viewport height from the top. */
const PEN = 0.6
/** A step's text and snippet rise in once its top passes this share of the viewport. */
const ENTER = 0.85
/** Dot spacing of .lp-step__line (--trail-gap), so lines grow one whole dot at a time. */
const DOT_PITCH = 8.5

export function useTrailScrollReveal(listRef: RefObject<HTMLElement | null>) {
  // Layout effect: hide and place everything before the first paint, so nothing flashes.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const steps = Array.from(list.querySelectorAll<HTMLElement>('.lp-step')).map((step) => ({
      step,
      num: step.querySelector<HTMLElement>('.lp-step__num'),
      line: step.querySelector<HTMLElement>('.lp-step__line'),
    }))
    let frame = 0

    const update = () => {
      frame = 0
      const pen = window.innerHeight * PEN
      const enter = window.innerHeight * ENTER
      for (const { step, num, line } of steps) {
        if (step.getBoundingClientRect().top < enter) step.classList.add('is-in')
        if (num) {
          const ring = num.getBoundingClientRect()
          step.classList.toggle('is-reached', ring.top + ring.height / 2 <= pen)
        }
        if (line) {
          const { top, height } = line.getBoundingClientRect()
          const drawn = Math.min(height, Math.max(0, pen - top))
          line.style.setProperty('--lp-draw-px', `${Math.floor(drawn / DOT_PITCH) * DOT_PITCH}px`)
        }
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    list.classList.add('lp-steps--animate')
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      list.classList.remove('lp-steps--animate')
    }
  }, [listRef])
}
