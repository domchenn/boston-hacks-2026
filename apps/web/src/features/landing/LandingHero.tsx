/**
 * Landing hero: "Follow the crumbs." headline, intro copy, Start a trail (→ /explore,
 * which signs visitors in first) and How it works buttons, with the tilted phone and a
 * dotted trail behind it on the right. From 960 px wide (two columns) the hero fills
 * exactly one screen under the header (--lp-header-h), and the headline and phone scale
 * with the screen height so nothing is cut off on load (.lp-phone-stage, sized from the
 * real window height by useFitPhoneToScreen). Used by LandingPage.
 */

import { useRef } from 'react'
import { Link } from 'react-router'
import { HeroPhone } from './HeroPhone'
import { useFitPhoneToScreen } from './useFitPhoneToScreen'

export function LandingHero() {
  const stageRef = useRef<HTMLDivElement>(null)
  useFitPhoneToScreen(stageRef)

  return (
    <section className="relative mx-auto max-w-[1264px] px-5 pt-12 pb-24 sm:px-8 sm:max-[959px]:pt-[72px] sm:max-[959px]:pb-[140px] min-[960px]:grid min-[960px]:min-h-[calc(100svh-var(--lp-header-h))] min-[960px]:content-center min-[960px]:py-0">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))] items-center gap-20 pb-[80px]">
        <div className="flex flex-col gap-8">
          <h1 className="m-0 text-[clamp(48px,min(6.5vw,12svh),78px)] leading-[0.95] font-extrabold tracking-[-0.055em]">
            Follow
            <br />
            the crumbs.
          </h1>
          <p className="m-0 max-w-[30ch] text-[19px] leading-[1.55] text-ink-2">
            You've lived here. Have you explored it? Breadcrumb turns Boston into small trails: a few stops to walk, ride or
            bike between, with little tasks along the way.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/explore" className="btn px-[26px]">
              Start a trail
            </Link>
            <a href="#how" className="btn btn--secondary">
              How it works
            </a>
          </div>
        </div>

        <div ref={stageRef} className="lp-phone-stage">
          <svg viewBox="0 0 560 720" aria-hidden className="lp-phone-stage__trail">
            <path
              d="M20 640 C 120 560, 40 420, 160 360 S 420 300, 400 160 S 500 40, 540 30"
              fill="none"
              stroke="var(--color-crumb)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="0 8.5"
            />
          </svg>
          <HeroPhone />
        </div>
      </div>
    </section>
  )
}
