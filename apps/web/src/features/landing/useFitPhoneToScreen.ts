/**
 * Sizes the hero phone to the real window height (two-column layout, 960 px and up):
 * sets --lp-fit on the stage to (window height − space above the hero − air) ÷ the
 * phone's visible height, clamped to 0.6–1.2, and updates on resize. landing.css also
 * has a pure-CSS estimate of --lp-fit as a fallback; this inline value overrides it so
 * every browser gets the same result. Used by LandingHero.
 */

import { useLayoutEffect, type RefObject } from 'react'

/** Visible height of the tilted phone at scale 1 (measured: frame top to bottom). */
const PHONE_VISIBLE_HEIGHT = 722
/** Space kept between the phone's bottom edge and the bottom of the window. */
const AIR = 40
const MIN_FIT = 0.6
const MAX_FIT = 1.2

export function useFitPhoneToScreen(stageRef: RefObject<HTMLElement | null>) {
  // Layout effect: size the phone before the first paint so it doesn't jump.
  useLayoutEffect(() => {
    const stage = stageRef.current
    const hero = stage?.closest('section')
    if (!stage || !hero) return
    const twoColumns = window.matchMedia('(min-width: 960px)')

    const update = () => {
      if (!twoColumns.matches) {
        stage.style.removeProperty('--lp-fit')
        return
      }
      // The hero's top in the page = the header's height above it.
      const above = hero.getBoundingClientRect().top + window.scrollY
      const fit = (window.innerHeight - above - AIR) / PHONE_VISIBLE_HEIGHT
      stage.style.setProperty('--lp-fit', Math.min(MAX_FIT, Math.max(MIN_FIT, fit)).toFixed(3))
    }

    update()
    window.addEventListener('resize', update)
    twoColumns.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      twoColumns.removeEventListener('change', update)
      stage.style.removeProperty('--lp-fit')
    }
  }, [stageRef])
}
