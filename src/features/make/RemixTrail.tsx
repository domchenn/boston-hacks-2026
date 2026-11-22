/**
 * Make a trail, pre-filled from someone else's trail (/make?remix=<id>, task G8).
 * Copies the name, description, category, length, stops (with their place-library
 * links) and the first crumb at each stop into MakeTrailForm; not the date or who
 * can see it. Saving sends remixed_from, so the new trail is yours and credited
 * "Remixed from @user". Says up front what wasn't copied. Your own trails go to
 * Edit instead.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Shuffle } from 'lucide-react'
import { getTrail, type TrailDetail } from '@/lib/api/trails'
import { draftFromTrail, editLosses, loadStopLibrary } from './edit-trail'
import type { TrailDraft } from './draft'
import { MakeTrailForm } from './MakeTrailPage'

type State =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'yours'; trail: TrailDetail }
  | { status: 'error'; message: string }
  | { status: 'ready'; trail: TrailDetail; draft: TrailDraft }

const NETWORK_ERROR = 'We couldn’t reach Breadcrumb. Check your connection and try again.'
const GENERIC_ERROR = 'Something went wrong loading that trail. Please try again.'

async function loadRemix(trailId: string, userId: string): Promise<State> {
  try {
    const trail = await getTrail(trailId)
    if (!trail) return { status: 'not_found' }
    if (trail.creator?.id === userId) return { status: 'yours', trail }
    const library = await loadStopLibrary(trailId)
    if (!library.ok) return { status: 'error', message: library.message }
    const draft: TrailDraft = {
      ...draftFromTrail({ trail, library: library.data }),
      // A remix is a fresh trail: no date, visible to everyone, credited to the original.
      when: 'anytime',
      scheduledLocal: '',
      communityId: null,
      remixedFrom: trail.id,
    }
    return { status: 'ready', trail, draft }
  } catch (error) {
    return { status: 'error', message: (error as { code?: string })?.code ? GENERIC_ERROR : NETWORK_ERROR }
  }
}

export function RemixTrail({ trailId, userId }: { trailId: string; userId: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadRemix(trailId, userId).then((s) => !cancelled && setState(s))
    return () => {
      cancelled = true
    }
  }, [trailId, userId, attempt])

  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label="Loading the trail to remix" className="animate-pulse space-y-4">
        <div className="h-10 w-56 rounded-pill bg-sand" />
        <div className="h-4 w-72 rounded-pill bg-sand" />
        <div className="h-64 w-full rounded-card bg-sand" />
      </div>
    )
  }
  if (state.status === 'not_found') {
    return (
      <Message title="This trail can’t be remixed">
        It may have been removed or made private.{' '}
        <Link to="/make" className="font-semibold text-crumb-strong hover:text-crumb-deep">
          Make your own instead
        </Link>
      </Message>
    )
  }
  if (state.status === 'yours') {
    return (
      <Message title="This is your trail">
        You can change it directly.
        <div className="mt-3">
          <Link to={`/trails/${state.trail.id}/edit`} className="btn btn--sm btn--secondary">
            Edit it instead
          </Link>
        </div>
      </Message>
    )
  }
  if (state.status === 'error') {
    return (
      <Message title={state.message}>
        <button
          type="button"
          className="btn btn--sm btn--secondary mt-2"
          onClick={() => {
            setState({ status: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </Message>
    )
  }

  const { trail, draft } = state
  return (
    <>
      <RemixNote trail={trail} />
      <MakeTrailForm
        key={trail.id}
        initialDraft={draft}
        heading="Remix a trail"
        subheading="Make it yours: rename it, swap stops, change the crumbs. It’s published as your trail."
      />
    </>
  )
}

/** "Remixing X by @user" plus anything the copy left out. */
function RemixNote({ trail }: { trail: TrailDetail }) {
  const losses = editLosses(trail)
  const by = trail.creator?.username ? `@${trail.creator.username}` : trail.creator?.display_name || 'someone'
  const left: string[] = []
  const otherCrumbs = losses.extraCrumbs + losses.betweenCrumbs
  if (otherCrumbs > 0) left.push(`${otherCrumbs} more ${otherCrumbs === 1 ? 'crumb' : 'crumbs'} (one crumb per stop is copied)`)
  if (losses.stopsWithDetails > 0) left.push('the notes on each stop')
  if (trail.scheduledAt) left.push('the date')
  return (
    <div role="note" className="mb-5 flex items-start gap-3 rounded-card border border-line bg-white p-4 text-sm leading-normal text-ink-2 md:p-5">
      <Shuffle aria-hidden className="mt-0.5 size-4 flex-none text-crumb-strong" />
      <p className="m-0">
        Remixing{' '}
        <Link to={`/trails/${trail.id}`} className="font-semibold text-ink hover:underline">
          {trail.title}
        </Link>{' '}
        by {by}. When you publish, it’s credited “Remixed from {by}”.
        {left.length > 0 ? ` Not copied: ${left.join(', ')}.` : ''}
      </p>
    </div>
  )
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-4 max-w-xl rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <p className="text-xl font-bold">{title}</p>
      <div className="mt-2 text-base text-ink-2">{children}</div>
    </div>
  )
}
