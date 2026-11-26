/**
 * Closing call to action at the bottom of the landing page: the big crumb mark,
 * "Your next stop is a few crumbs away." and Sign up / Log in. Used by LandingPage.
 */

import { Link } from 'react-router'
import { CrumbMark } from './CrumbMark'

export function LandingCta() {
  return (
    <section className="mx-auto flex max-w-[1264px] flex-col items-center gap-8 px-5 py-32 text-center sm:px-8 sm:py-[180px]">
      <CrumbMark size={110} label="Breadcrumb mark" />
      <h2 className="m-0 text-[clamp(38px,5.5vw,64px)] leading-none font-extrabold tracking-[-0.045em]">
        Your next stop
        <br />
        is a few crumbs away.
      </h2>
      <p className="m-0 max-w-[36ch] text-[18px] leading-[1.55] text-ink-2">Pick a trail and head out.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/signup" className="btn btn--lg px-[30px]">
          Sign up
        </Link>
        <Link to="/login" className="btn btn--lg btn--secondary px-7">
          Log in
        </Link>
      </div>
    </section>
  )
}
