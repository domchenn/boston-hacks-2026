/**
 * Privacy (/privacy) and Terms (/terms): short, plain-language pages saying
 * what Breadcrumb stores, what it never stores (your location), which services
 * it relies on, and the basic rules for using it. Written by the team for the
 * hackathon version; have them reviewed before a real launch.
 * Routes: /privacy, /terms · Owner: Dom (task D8)
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router'

function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[68ch] pb-10 text-base leading-[1.6] text-ink-2 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-[2rem] font-extrabold tracking-[var(--tracking-title)] text-ink">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
      {children}
    </article>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="November 2026">
      <p className="mt-4">
        Breadcrumb helps Boston students find and run trails around the city. Here's what we keep, what we don't, and why.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <b>Your account:</b> your email, and your name and photo if you sign in with Google. Your username, display
          name, university and bio if you add them.
        </li>
        <li>
          <b>What you make:</b> trails you create, ratings and reviews you write, and photos you add to trails. Trails,
          reviews and trail photos are public.
        </li>
        <li>
          <b>Your progress:</b> which trails you saved, joined, started or finished, and which crumbs you ticked. This is
          private to you, except finished trails can appear on your profile and to people who follow you, and the
          number of people going to a scheduled trail is shown.
        </li>
        <li>
          <b>Reports</b> you send about content, so our team can review them.
        </li>
      </ul>

      <h2>What we never store</h2>
      <ul>
        <li>
          <b>Your location.</b> The Active trail map and the Nearby tab use your location only on your device, only
          after you allow it, and never send it to our servers or save it.
        </li>
        <li>Payment details. Breadcrumb is free and doesn't take payments.</li>
      </ul>

      <h2>Services we use</h2>
      <ul>
        <li>
          <b>Supabase</b> hosts our database, sign-in and photo storage.
        </li>
        <li>
          <b>Google</b> for sign-in (if you choose it) and Google Maps for maps and directions.
        </li>
        <li>
          <b>MBTA</b> and <b>Bluebikes</b> public feeds for live train, bus and bike information. We only ask them about
          places on a trail, never about you.
        </li>
        <li>
          <b>Vercel</b> hosts the website.
        </li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile, and delete your trails, reviews and photos, at any time in the app.</li>
        <li>
          Choose who sees each trail (everyone, friends or close friends) and make your account private. Friends, meaning
          people you follow who follow you back, can see when you&apos;ve both saved the same trail; unfollowing ends that.
        </li>
        <li>To delete your account and everything linked to it, contact the team and we'll remove it.</li>
      </ul>

      <p className="mt-8">
        See also our <Link to="/terms" className="font-semibold text-crumb-strong">Terms</Link>.
      </p>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Terms" updated="November 2026">
      <p className="mt-4">By using Breadcrumb you agree to these simple rules.</p>

      <h2>Be a good trail-maker</h2>
      <ul>
        <li>Only add real places, with accurate information. Don't make up hours, events or prices.</li>
        <li>No hateful, harassing, sexual, or dangerous content, and no spam or ads.</li>
        <li>Only post photos you took or have the right to share, and be thoughtful about photographing other people.</li>
        <li>Anyone can report content. Our team may hide trails or remove reviews and photos that break these rules.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own what you create. By posting it, you let Breadcrumb show it in the app (for example, your trail on the
        Explore page and your photos on a trail).
      </p>

      <h2>Getting around safely</h2>
      <p>
        Trails, directions, transit times and bike availability are suggestions and live data from other services. They
        can be wrong or out of date. Check that places are open, watch where you're going, follow local rules, and use
        your judgment. You're responsible for your own safety on a trail.
      </p>

      <h2>No guarantees</h2>
      <p>
        Breadcrumb is provided as-is while we build it. Features may change or break, and we can't promise it will
        always be available.
      </p>

      <p className="mt-8">
        See also our <Link to="/privacy" className="font-semibold text-crumb-strong">Privacy</Link> page.
      </p>
    </LegalPage>
  )
}
