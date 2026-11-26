/**
 * Landing page footer: the wordmark, Privacy / Terms links and the line saying
 * Breadcrumb isn't affiliated with the MBTA (keep it). Used by LandingPage.
 */

import { Link } from 'react-router'
import { CrumbMark } from './CrumbMark'

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1264px] flex-wrap items-center justify-between gap-4 px-5 pt-10 pb-14 text-[13px] text-muted-foreground sm:px-8">
        <span className="inline-flex items-center gap-2 text-ink">
          <CrumbMark size={20} />
          <strong className="text-[16px] font-extrabold tracking-[-0.03em]">breadcrumb</strong>
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/privacy" className="lp-link text-muted-foreground hover:text-ink">
            Privacy
          </Link>
          <Link to="/terms" className="lp-link text-muted-foreground hover:text-ink">
            Terms
          </Link>
          <span>Not affiliated with or endorsed by the MBTA.</span>
        </span>
      </div>
    </footer>
  )
}
