/**
 * Rate a finished trail (docs/mockups/Mobile-Finished): "Trail finished!" header,
 * four 1–5 star questions (fun, memorable, worth the money, worth the time), an
 * optional review, then Post rating or Skip, both back to /trails/:id. Loads
 * getTrail + getMyStatus + getMyRating; an existing rating pre-fills the form and
 * can be removed. Logged out → login; your own or unfinished trail → a message.
 * Route: /trails/:id/rate · Owner: Jason
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Star, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { TrailLine } from '@/components/TrailLine'
import { formatShortDate } from '@/components/trailFormat'
import { getMyStatus } from '@/lib/api/progress'
import {
  MAX_REVIEW_LENGTH,
  deleteMyRating,
  getMyRating,
  rateTrail,
  ratingErrorMessage,
  RatingError,
  type MyRating,
} from '@/lib/api/ratings'
import { getTrail, type TrailDetail } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'
import type { UserSidequestStatus } from '@/types/db-values'
import { RATING_QUESTIONS, type RatingKey } from './ratingQuestions'
import { TrailMessage } from './TrailPageMessage'
import { isTrailId, loginPath, type TrailNotice } from './trailLinks'

type LoadResult = {
  key: string
  trail?: TrailDetail | null
  /** undefined = couldn't tell (getMyStatus failed); the database still checks when posting. */
  status?: UserSidequestStatus | null
  rating?: MyRating | null
  error?: string
}

type Scores = Record<RatingKey, number>

const fieldClass =
  'w-full rounded-[10px] border border-line-strong bg-white px-3.5 py-3 text-base leading-snug text-ink outline-none placeholder:text-muted-foreground focus:shadow-[var(--focus-ring)]'

/** "Fun", "Fun and Memorable", "Fun, Memorable and Worth the time". */
function listWords(words: string[]) {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? '')
}

function RateSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto max-w-xl animate-pulse space-y-4">
      <div className="size-11 rounded-full bg-sand" />
      <div className="h-14 w-full rounded-pill bg-sand" />
      <div className="h-4 w-32 rounded-pill bg-sand" />
      <div className="h-9 w-3/4 rounded-pill bg-sand" />
      <div className="h-64 w-full rounded-card bg-sand" />
    </div>
  )
}

/** One question: a label and five big star radio buttons (arrow keys move between them). */
function StarQuestion({
  name,
  label,
  value,
  invalid,
  onChange,
}: {
  name: string
  label: string
  value: number
  invalid: boolean
  onChange: (value: number) => void
}) {
  const labelId = useId()
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line py-0.5">
      <span id={labelId} className={cn('min-w-0 text-base leading-tight font-semibold', invalid && 'text-crumb-deep')}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} aria-invalid={invalid || undefined} className="flex shrink-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="grid h-11 w-10 cursor-pointer place-items-center rounded-full has-[:focus-visible]:shadow-[var(--focus-ring)] sm:w-11"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <Star
              aria-hidden
              className={cn(
                'size-[26px] stroke-[1.6] transition-colors',
                n <= value ? 'fill-crumb-strong text-crumb-strong' : 'text-line-strong',
              )}
            />
            <span className="sr-only">
              {n} of 5
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

/** The form itself. Mounted once the trail and any existing rating have loaded, so it starts pre-filled. */
function RateTrailForm({ trail, existing }: { trail: TrailDetail; existing: MyRating | null }) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const headingId = useId()
  const reviewId = useId()
  const [scores, setScores] = useState<Scores>(() => ({
    enjoyment: existing?.enjoyment ?? 0,
    memorability: existing?.memorability ?? 0,
    price: existing?.price ?? 0,
    time: existing?.time ?? 0,
  }))
  const [review, setReview] = useState(existing?.review ?? '')
  const [busy, setBusy] = useState<'post' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const editing = existing !== null
  const trailPath = `/trails/${trail.id}`
  const missing = RATING_QUESTIONS.filter((q) => scores[q.key] === 0)

  /** Back to Trail detail, replacing this page so Back doesn't reopen the form. */
  const leave = (notice: string) => navigate(trailPath, { replace: true, state: { notice } satisfies TrailNotice })

  async function post(event: FormEvent) {
    event.preventDefault()
    if (missing.length > 0) {
      setShowMissing(true)
      setError(
        missing.length === RATING_QUESTIONS.length
          ? 'Pick 1 to 5 stars for each question.'
          : `Pick a star rating for ${listWords(missing.map((q) => q.label))}.`,
      )
      formRef.current?.querySelector<HTMLInputElement>(`input[name="${missing[0].key}"]`)?.focus()
      return
    }
    setBusy('post')
    setError(null)
    try {
      await rateTrail(trail.id, { ...scores, review })
      leave(editing ? 'Your rating is updated.' : 'Thanks! Your rating is posted.')
    } catch (err) {
      setError(ratingErrorMessage(err))
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('remove')
    setError(null)
    try {
      await deleteMyRating(trail.id)
      leave('Your rating was removed.')
    } catch (err) {
      setError(ratingErrorMessage(err))
      setBusy(null)
      setConfirmRemove(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={post} noValidate className="mx-auto max-w-xl pb-36 md:pb-0">
      <Link to={trailPath} aria-label="Close, back to the trail" className="icon-btn">
        <X aria-hidden />
      </Link>

      <div className="trail trail--done mt-5">
        <TrailLine stops={trail.stopCount} state="done" height={56} />
      </div>
      <p className="mt-4 text-sm font-semibold text-done">
        {editing ? `Trail finished · you rated it ${formatShortDate(existing.createdAt)}` : 'Trail finished!'}
      </p>
      <h1 className="mt-1.5 text-[1.75rem] leading-[1.1] font-extrabold tracking-[var(--tracking-title)] md:text-[2.25rem]">
        {trail.title}
      </h1>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-base font-semibold text-ink-2">
        <span>
          {trail.stopCount} {trail.stopCount === 1 ? 'stop' : 'stops'}
        </span>
        <span>
          {trail.crumbCount} {trail.crumbCount === 1 ? 'crumb' : 'crumbs'}
        </span>
      </div>

      <section aria-labelledby={headingId} className="mt-5 rounded-card border border-line bg-white px-4 pt-3.5 pb-1.5">
        <h2 id={headingId} className="mb-1 text-lg font-bold">
          {editing ? 'Change your rating' : 'How was it?'}
        </h2>
        {RATING_QUESTIONS.map(({ key, label }) => (
          <StarQuestion
            key={key}
            name={key}
            label={label}
            value={scores[key]}
            invalid={showMissing && scores[key] === 0}
            onChange={(value) => {
              setScores((s) => ({ ...s, [key]: value }))
              setError(null)
            }}
          />
        ))}
      </section>

      <div className="mt-4">
        <label htmlFor={reviewId} className="block text-base font-semibold">
          Add a review <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id={reviewId}
          rows={4}
          maxLength={MAX_REVIEW_LENGTH}
          placeholder="What should the next person know?"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          className={cn(fieldClass, 'mt-2 resize-y')}
        />
        {review.length > MAX_REVIEW_LENGTH - 200 ? (
          <p className="mt-1 text-right text-sm text-muted-foreground">
            {review.length.toLocaleString('en-US')} / {MAX_REVIEW_LENGTH.toLocaleString('en-US')}
          </p>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
          {confirmRemove ? (
            <>
              <span className="text-base font-semibold">Remove your rating and review?</span>
              <button type="button" className="btn btn--sm btn--secondary" onClick={remove} disabled={busy !== null}>
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => setConfirmRemove(false)}
                disabled={busy !== null}
              >
                Keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              className="h-11 text-base font-semibold text-crumb-strong hover:text-crumb-deep"
              onClick={() => setConfirmRemove(true)}
              disabled={busy !== null}
            >
              Remove my rating
            </button>
          )}
        </div>
      ) : null}

      {/* Phones: pinned to the bottom like the mockup. Desktop: right under the form. */}
      <div className="action-bar fixed inset-x-0 bottom-0 z-20 md:static md:mt-6 md:bg-none md:p-0">
        {error ? (
          <p role="alert" className="mb-2 text-center text-sm font-medium text-crumb-deep md:text-left">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
          <button type="submit" className="btn btn--lg btn--block md:w-auto md:px-8" disabled={busy !== null}>
            {busy === 'post' ? 'Posting…' : editing ? 'Update rating' : 'Post rating'}
          </button>
          <Link to={trailPath} className="btn btn--ghost h-11 md:px-5">
            {editing ? 'Cancel' : 'Skip for now'}
          </Link>
        </div>
      </div>
    </form>
  )
}

export function RateTrailPage() {
  const { id = '' } = useParams()
  const valid = isTrailId(id)
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user.id ?? null
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LoadResult | null>(null)

  const key = `${id}|${userId}|${attempt}`
  const loading = valid && (sessionLoading || (userId !== null && result?.key !== key))

  useEffect(() => {
    if (!valid || !userId) return
    let cancelled = false
    Promise.all([
      getTrail(id),
      getMyStatus(id).then(
        (status) => status,
        () => undefined,
      ),
      getMyRating(id),
    ]).then(
      ([trail, status, rating]) => !cancelled && setResult({ key, trail, status, rating }),
      (error: unknown) =>
        !cancelled &&
        setResult({
          key,
          error:
            error instanceof RatingError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Something went wrong.',
        }),
    )
    return () => {
      cancelled = true
    }
  }, [id, key, userId, valid])

  const trail = !loading && result?.key === key ? result.trail : undefined

  useEffect(() => {
    if (!trail) return
    const previous = document.title
    document.title = `Rate ${trail.title} · breadcrumb`
    return () => {
      document.title = previous
    }
  }, [trail])

  if (!valid) {
    return (
      <TrailMessage title="Trail not found">
        <p>Check the link and try again.</p>
      </TrailMessage>
    )
  }
  if (!sessionLoading && !userId) return <Navigate to={loginPath(`/trails/${id}/rate`)} replace />
  if (loading || !result) return <RateSkeleton />

  const trailPath = `/trails/${id}`

  if (result.error) {
    return (
      <TrailMessage title="Couldn't load this trail" backTo={trailPath} backLabel="Back to the trail">
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

  if (trail.creator?.id === userId) {
    return (
      <TrailMessage title="This is your trail" backTo={trailPath} backLabel="Back to the trail">
        <p>Trail makers can't rate their own trails. Ratings come from people who finish it.</p>
        <Link to={trailPath} className="btn btn--sm btn--secondary mt-4">
          Back to the trail
        </Link>
      </TrailMessage>
    )
  }

  // Unknown status (undefined) falls through to the form; the database still refuses unfinished trails.
  if (result.status !== undefined && result.status !== 'completed') {
    const inProgress = result.status === 'in_progress'
    return (
      <TrailMessage title="Finish the trail first" backTo={trailPath} backLabel="Back to the trail">
        <p>You can rate {trail.title} once you've finished it.</p>
        <Link to={inProgress ? `${trailPath}/go` : trailPath} className="btn btn--sm btn--secondary mt-4">
          {inProgress ? 'Continue trail' : 'Back to the trail'}
        </Link>
      </TrailMessage>
    )
  }

  return <RateTrailForm key={trail.id} trail={trail} existing={result.rating ?? null} />
}
