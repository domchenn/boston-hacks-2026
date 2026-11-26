/**
 * One-shot scroll reveal: adds `animateClass` to the element right away (so CSS can
 * hide what will appear), then `inClass` the first time enough of it is on screen.
 * Skipped under prefers-reduced-motion, so everything simply shows. Used by
 * TrailMapSection to pop the map's stops in order.
 */

import { useLayoutEffect, type RefObject } from 'react'

export function useRevealOnView(
  ref: RefObject<HTMLElement | null>,
  { animateClass, inClass = 'is-in', threshold = 0.4 }: { animateClass: string; inClass?: string; threshold?: number },
) {
  // Layout effect: hide before the first paint so nothing flashes.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    el.classList.add(animateClass)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.classList.add(inClass)
        observer.disconnect()
      },
      { threshold },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      el.classList.remove(animateClass, inClass)
    }
  }, [ref, animateClass, inClass, threshold])
}
