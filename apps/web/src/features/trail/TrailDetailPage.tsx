/**
 * Trail detail page (docs/mockups/Web-Detail + Mobile-Detail), loaded with getTrail(id):
 * eyebrow, title, cost / time / stops / crumbs / rating, description, Start trail /
 * Save / Share / Rate this trail (TrailActions), the stops with crumbs, Good to know,
 * the creator, photos (TrailPhotos, hidden when there are none) and reviews. The route map (RouteMap) sits on the right on desktop and
 * above the stops on phones. Phones get a sticky action bar. Shows the Rate page's
 * "rating posted" notice from router state.
 * Route: /trails/:id · Owner: Jason
 */

import { useEffect, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { RouteMap } from '@/components/RouteMap'
import { ReportButton } from '@/features/reports/ReportButton'
import { TransitAlerts } from '@/components/TransitAlerts'
import { categoryLabel, formatCost, formatMinutes } from '@/components/trailFormat'
import { getTrail, type TrailDetail } from '@/lib/api/trails'
import { YourTrailBar } from '@/features/make/YourTrailBar'
import { TrailRemixRow } from '@/features/make/TrailRemixRow'
import { TrailActions } from './TrailActions'
import { TrailCreatorCard, TrailGoodToKnow } from './TrailGoodToKnow'
import { BackLink, TrailMessage } from './TrailPageMessage'
import { TrailPhotos } from './TrailPhotos'
import { TrailReviews } from './TrailReviews'
import { TrailStops } from './TrailStops'
import { isTrailId, leadingTrailId, type TrailNotice } from './trailLinks'
import { useTrailActions } from './useTrailActions'

type LoadResult = { key: string; trail?: TrailDetail | null; error?: string }

/** Grey blocks in the page's own layout (two columns with the map on desktop), so nothing jumps on load. */
function TrailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading trail">
      <BackLink />
      <div className="mt-2 animate-pulse lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-10">
        <div className="grid content-start gap-4">
          <div className="h-4 w-40 rounded-pill bg-sand" />
          <div className="h-10 w-3/4 rounded-pill bg-sand md:h-12" />
          <div className="h-4 w-56 rounded-pill bg-sand" />
          <div className="h-20 w-full max-w-[60ch] rounded-card bg-sand" />
          <div className="hidden gap-3 md:flex">
            <div className="h-12 w-36 rounded-pill bg-sand" />
            <div className="h-12 w-28 rounded-pill bg-sand" />
          </div>
          <div className="mt-4 h-64 w-full rounded-card bg-sand md:mt-6" />
        </div>
        <div className="hidden flex-col gap-4 lg:flex">
          <div className="aspect-[400/420] w-full rounded-card bg-sand" />
          <div className="h-48 w-full rounded-card bg-sand" />
        </div>
      </div>
    </div>
  )
}

export function TrailDetailPage() {
  const { id = '' } = useParams()
  const valid = isTrailId(id)
  // "Thanks! Your rating is posted." etc., handed over by the Rate page.
  const location = useLocation()
  const notice = (location.state as TrailNotice | null)?.notice
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)
  const actions = useTrailActions(id)

  const key = `${id}|${attempt}`
  const loading = valid && result?.key !== key

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    getTrail(id).then(
      (trail) => !cancelled && setResult({ key, trail }),
      (error: unknown) =>
        !cancelled && setResult({ key, error: error instanceof Error ? error.message : 'Something went wrong.' }),
    )
    return () => {
      cancelled = true
    }
  }, [id, key, valid])

  const trail = !loading && result?.key === key ? result.trail : undefined

  useEffect(() => {
    if (!trail) return
    const previous = document.title
    document.title = `${trail.title} · breadcrumb`
    return () => {
      document.title = previous
    }
  }, [trail])

  // A shared link with the message stuck to the id: go to the trail itself.
  const repaired = valid ? null : leadingTrailId(id)
  if (repaired) return <Navigate replace to={`/trails/${repaired}${location.search}`} state={location.state} />

  if (loading) return <TrailSkeleton />

  if (result?.error) {
    return (
      <TrailMessage title="Couldn't load this trail">
        <p>{result.error}</p>
        <button type="button" className="btn btn--sm btn--secondary mt-4" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </TrailMessage>
    )
  }

  if (!trail) {
    return (
      <TrailMessage title="Trail not found">
        <p>It may have been removed, or it isn't published yet.</p>
        <Link to="/" className="btn btn--sm btn--secondary mt-4">
          Browse trails
        </Link>
      </TrailMessage>
    )
  }

  const eyebrow = [
    categoryLabel(trail.category, trail.customCategory),
    trail.isCurated ? 'Curated' : null,
    trail.visibility === 'friends' ? 'Friends only' : trail.visibility === 'close_friends' ? 'Close friends only' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="pb-28 md:pb-0">
      <BackLink />
      {notice ? (
        <p
          role="status"
          className="mt-2 mb-2 flex w-fit items-center gap-2 rounded-pill bg-[var(--color-green-tint)] px-4 py-2 text-sm font-semibold text-done"
        >
          <Check aria-hidden className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-10">
        <article className="min-w-0">
          <p className="text-sm font-semibold text-crumb-strong md:text-[0.875rem]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-[1.75rem] leading-[1.05] font-extrabold tracking-[var(--tracking-title)] md:text-[3rem]">
            {trail.title}
          </h1>
          <YourTrailBar trailId={trail.id} creatorId={trail.creator?.id ?? null} status={trail.status} />
          <TrailRemixRow trail={trail} />

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-base font-semibold text-ink-2 md:mt-3.5 md:text-lg">
            {trail.estimatedCost !== null ? <span>{formatCost(trail.estimatedCost)}</span> : null}
            {trail.estimatedMinutes !== null ? <span>{formatMinutes(trail.estimatedMinutes)}</span> : null}
            <span>
              {trail.stopCount} {trail.stopCount === 1 ? 'stop' : 'stops'}
            </span>
            <span>
              {trail.crumbCount} {trail.crumbCount === 1 ? 'crumb' : 'crumbs'}
            </span>
            {trail.rating.count > 0 && trail.rating.average !== null ? (
              <span className="rating">
                <Star aria-hidden />
                {trail.rating.average.toFixed(1)} ({trail.rating.count})
                <span className="sr-only"> out of 5, {trail.rating.count} ratings</span>
              </span>
            ) : null}
          </div>

          {trail.description ? (
            <p className="mt-4 max-w-[60ch] text-base leading-[1.55] text-ink-2 md:mt-4.5 md:text-lg">{trail.description}</p>
          ) : null}

          <div className="mt-6 hidden md:block">
            <TrailActions
              trailId={trail.id}
              actions={actions}
              title={trail.title}
              layout="inline"
            />
          </div>

          <h2 className="mt-8 text-xl font-bold tracking-[var(--tracking-tight)] md:mt-10">The trail</h2>
          <TransitAlerts stops={trail.stops} className="mb-4" />
          <RouteMap stops={trail.stops} primaryLine={trail.primaryLine} className="mb-4 aspect-[4/3] lg:hidden" />
          <TrailStops stops={trail.stops} betweenStopCrumbs={trail.betweenStopCrumbs} primaryLine={trail.primaryLine} />

          <div className="mt-6 grid gap-4 lg:hidden">
            <TrailGoodToKnow trail={trail} />
            <TrailCreatorCard trail={trail} />
          </div>

          <TrailPhotos trailId={trail.id} trailTitle={trail.title} />

          <h2 className="mt-8 text-xl font-bold tracking-[var(--tracking-tight)] md:mt-10">Reviews</h2>
          <TrailReviews rating={trail.rating} reviews={trail.reviews} />
          <div className="mt-6">
            <ReportButton targetType="trail" targetId={trail.id} ownerId={trail.creator?.id} what="this trail" />
          </div>
        </article>

        <aside aria-label="Map and details" className="sticky top-24 hidden flex-col gap-4 lg:flex">
          <RouteMap stops={trail.stops} primaryLine={trail.primaryLine} className="aspect-[400/420]" />
          <TrailGoodToKnow trail={trail} />
          <TrailCreatorCard trail={trail} />
        </aside>
      </div>

      <TrailActions
        trailId={trail.id}
        actions={actions}
        title={trail.title}
        layout="bar"
      />
    </div>
  )
}
