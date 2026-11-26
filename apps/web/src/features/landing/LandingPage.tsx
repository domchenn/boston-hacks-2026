/**
 * Marketing landing page that signed-out visitors see at / (AppLayout renders it
 * in place of the app shell; signed-in users get Explore there). Built from
 * docs/mockups/breadcrumb-landing/index.html: header, hero with phone, kinds of
 * trails, How it works, trail map, closing call to action and footer.
 */

import { CategoryStrip } from './CategoryStrip'
import { HowItWorks } from './HowItWorks'
import { LandingCta } from './LandingCta'
import { LandingFooter } from './LandingFooter'
import { LandingHeader } from './LandingHeader'
import { LandingHero } from './LandingHero'
import { TrailMapSection } from './TrailMapSection'
import './landing.css'

export function LandingPage() {
  return (
    <div id="top" className="landing min-h-dvh bg-paper text-ink">
      <title>Breadcrumb · Follow the crumbs</title>
      <LandingHeader />
      <main>
        <LandingHero />
        <CategoryStrip />
        <HowItWorks />
        <TrailMapSection />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  )
}
