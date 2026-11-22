/**
 * Start trail / Save / Join buttons for the Trail detail page. Which buttons show
 * depends on the viewer's status (saved, going, in progress, finished); a finished
 * trail leads with "Rate this trail" until it's rated, then offers "Edit your rating".
 * Renders inline on desktop and as a sticky bottom bar on phones (layout="bar");
 * both share one useTrailActions() state from the page.
 */

import { Bookmark, BookmarkCheck, Check, Star, UserPlus } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import type { TrailActionsState } from './useTrailActions'

type TrailActionsProps = {
  trailId: string
  actions: TrailActionsState
  scheduled: boolean
  layout: 'inline' | 'bar'
}

export function TrailActions({ trailId, actions, scheduled, layout }: TrailActionsProps) {
  const { status, statusLoading, hasRated, busy, error, start, toggleSave, join } = actions
  const bar = layout === 'bar'
  const ratePath = `/trails/${trailId}/rate`

  const startLabel =
    status === 'in_progress' ? 'Continue trail' : status === 'completed' ? 'Do it again' : 'Start trail'
  // Finished but not rated yet: rating becomes the main button, "Do it again" steps back.
  const rateFirst = status === 'completed' && hasRated === false
  // One row per user per trail, so Save only makes sense before you've joined or started.
  const canSave = status === null || status === 'saved' || status === 'aborted'
  const saved = status === 'saved'
  const canJoin = scheduled && (status === null || status === 'saved' || status === 'aborted')
  const going = status === 'signed_up'

  const startButton = (
    <button
      type="button"
      className={cn(
        'btn',
        rateFirst && 'btn--secondary',
        bar ? (rateFirst ? 'btn--lg shrink-0 px-5' : 'btn--lg min-w-0 flex-1') : rateFirst ? 'px-5.5' : 'px-7',
      )}
      onClick={start}
      disabled={busy !== null || statusLoading}
    >
      {busy === 'start' ? 'Starting…' : startLabel}
    </button>
  )

  return (
    <div className={cn(bar && 'action-bar fixed inset-x-0 bottom-0 z-20 md:hidden')}>
      <div className={cn('flex flex-wrap items-center gap-3', bar && 'flex-nowrap')}>
        {rateFirst ? (
          <Link to={ratePath} className={cn('btn', bar ? 'btn--lg min-w-0 flex-1' : 'px-7')}>
            <Star aria-hidden />
            Rate this trail
          </Link>
        ) : null}

        {startButton}

        {canSave ? (
          <button
            type="button"
            className={cn('btn btn--secondary', bar ? 'btn--lg w-14 shrink-0 px-0' : 'px-5.5')}
            aria-pressed={saved}
            aria-label={bar ? (saved ? 'Saved, tap to unsave' : 'Save trail') : undefined}
            onClick={toggleSave}
            disabled={busy !== null || statusLoading}
          >
            {saved ? <BookmarkCheck aria-hidden className="fill-current" /> : <Bookmark aria-hidden />}
            {bar ? null : saved ? 'Saved' : 'Save'}
          </button>
        ) : null}

        {canJoin ? (
          <button
            type="button"
            className={cn('btn btn--secondary', bar ? 'btn--lg shrink-0 px-5' : 'px-5.5')}
            onClick={join}
            disabled={busy !== null || statusLoading}
          >
            <UserPlus aria-hidden />
            {busy === 'join' ? 'Joining…' : 'Join'}
          </button>
        ) : null}

        {status === 'completed' && hasRated && bar ? (
          <Link to={ratePath} className="btn btn--secondary btn--lg shrink-0 px-5">
            Edit rating
          </Link>
        ) : null}

        {going && !bar ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-scheduled">
            <Check aria-hidden className="size-4" />
            You're going
          </span>
        ) : null}
        {status === 'completed' && !bar ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-done">
            <Check aria-hidden className="size-4" />
            You finished this trail
            {hasRated ? (
              <>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <Link to={ratePath} className="text-crumb-strong hover:text-crumb-deep">
                  Edit your rating
                </Link>
              </>
            ) : null}
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className={cn('mt-2 text-sm font-medium text-crumb-deep', bar && 'text-center')}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
