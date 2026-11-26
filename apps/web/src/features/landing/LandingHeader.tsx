/**
 * Landing page header: wordmark, in-page links (How it works, Trails), Log in and
 * Sign up. Below 600 px the in-page links are hidden and gaps tighten so "Sign up"
 * stays on the first line down to 360 px (the mockup wrapped there). From 960 px up it is exactly --lp-header-h tall,
 * which the hero subtracts to fill the first screen. Used by LandingPage.
 */

import { Link } from 'react-router'
import { CrumbMark } from './CrumbMark'

export function LandingHeader() {
  return (
    <header className="mx-auto flex max-w-[1264px] flex-wrap items-center justify-between gap-3 px-5 max-[399px]:px-4 sm:gap-4 py-6 sm:px-8 sm:py-7 min-[960px]:h-[var(--lp-header-h)] min-[960px]:py-0">
      <a href="#top" className="lp-link inline-flex items-center gap-[9px] text-ink" aria-label="breadcrumb, back to top">
        <CrumbMark size={25} />
        <span className="text-[21px] font-extrabold tracking-[-0.03em]">breadcrumb</span>
      </a>
      <nav aria-label="Main" className="flex items-center gap-x-[22px] gap-y-2 text-[15px] font-medium max-[599px]:gap-x-2">
        <a href="#how" className="lp-link max-[599px]:hidden">
          How it works
        </a>
        <a href="#trails" className="lp-link max-[599px]:hidden">
          Trails
        </a>
        <span aria-hidden className="h-5 w-px bg-line max-[599px]:hidden" />
        <Link to="/login" className="lp-link inline-flex min-h-11 items-center px-1.5 font-semibold text-ink">
          Log in
        </Link>
        <Link to="/signup" className="btn btn--ink h-11 px-5 text-[15px]">
          Sign up
        </Link>
      </nav>
    </header>
  )
}
