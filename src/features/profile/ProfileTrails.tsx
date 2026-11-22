/**
 * The tabs on a profile. Your own page: Finished (private progress) / Made /
 * Badges (ProfileBadges); saved trails have their own Saved page. Someone else's: Trails
 * (their published trails) / Activity (PersonActivity: what they made, finished
 * or joined, if you follow them).
 * The open tab lives in ?tab= so it survives refresh and can be linked. Each tab
 * has loading, error and empty states (empty-trail.svg, per the style guide).
 * Cards use the style guide's .trail-card; swap in the shared TrailCard (task J1)
 * once it lands.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CircleAlert, Pencil } from 'lucide-react'
import emptyTrail from '../../../docs/assets/svg/empty-trail.svg'
import { ProfileBadges } from '@/features/badges/ProfileBadges'
import { PersonActivity } from '@/features/friends/FriendsActivity'
import { getMadeTrails, getMyTrails, type ProfileTrail, type ProgressTab, type Result } from './api'

type TrailTabId = 'finished' | 'made'
type TabId = TrailTabId | 'badges' | 'activity'

const TABS: Record<TrailTabId, { label: string; status: ProgressTab | null }> = {
  finished: { label: 'Finished', status: 'completed' },
  made: { label: 'Made', status: null },
}
const LABELS: Record<TabId, string> = {
  finished: 'Finished',
  made: 'Made',
  badges: 'Badges',
  activity: 'Activity',
}
const OWN_TABS: TabId[] = ['finished', 'made', 'badges']
const OTHER_TABS: TabId[] = ['made', 'activity']

export function ProfileTrails({
  userId,
  isOwn,
  name,
  viewerId,
}: {
  userId: string
  isOwn: boolean
  name: string
  viewerId: string | null
}) {
  const id = useId()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab') as TabId | null
  const tabs = isOwn ? OWN_TABS : OTHER_TABS
  const tab: TabId = requested && tabs.includes(requested) ? requested : tabs[0]
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  function select(next: TabId, focus = false) {
    setSearchParams(
      (params) => {
        params.set('tab', next)
        return params
      },
      { replace: true },
    )
    if (focus) tabRefs.current[next]?.focus()
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.indexOf(tab)
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    const nextIndex = (moves[event.key] + tabs.length) % tabs.length
    select(tabs[nextIndex], true)
  }

  return (
    <section className="profile-trails">
      <div className="tabs profile-tabs" role="tablist" aria-label={isOwn ? 'Your trails and badges' : `${name}’s trails`}>
        {tabs.map((t) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[t] = el
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${t}`}
            aria-selected={t === tab}
            aria-controls={`${id}-panel`}
            tabIndex={t === tab ? 0 : -1}
            className="tab"
            onClick={() => select(t)}
            onKeyDown={onTabKeyDown}
          >
            {!isOwn && t === 'made' ? 'Trails' : LABELS[t]}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'badges' ? (
          <ProfileBadges userId={userId} />
        ) : tab === 'activity' ? (
          viewerId ? (
            <PersonActivity viewerId={viewerId} personId={userId} name={name} />
          ) : null
        ) : (
          <TrailList key={`${userId}:${tab}`} userId={userId} tab={tab} isOwn={isOwn} name={name} />
        )}
      </div>
    </section>
  )
}

type ListState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; trails: ProfileTrail[] }

function TrailList({ userId, tab, isOwn, name }: { userId: string; tab: TrailTabId; isOwn: boolean; name: string }) {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const status = TABS[tab].status
    const request: Promise<Result<ProfileTrail[]>> = status ? getMyTrails(userId, status) : getMadeTrails(userId)
    request.then((result) => {
      if (cancelled) return
      setState(result.ok ? { status: 'ready', trails: result.data } : { status: 'error', message: result.message })
    })
    return () => {
      cancelled = true
    }
  }, [userId, tab, attempt])

  if (state.status === 'loading') {
    return (
      <ul className="profile-list" aria-busy="true" aria-label="Loading trails">
        <li className="profile-skeleton profile-skeleton--card" />
        <li className="profile-skeleton profile-skeleton--card" />
      </ul>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="profile-error" role="alert">
        <CircleAlert aria-hidden />
        <p>{state.message}</p>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => {
            setState({ status: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (state.trails.length === 0) return <EmptyTab tab={tab} isOwn={isOwn} name={name} />

  return (
    <ul className="profile-list">
      {state.trails.map((trail) => (
        <li key={trail.id} className="grid content-start gap-1">
          <ProfileTrailCard trail={trail} tab={tab} />
          {/* Your own trails (drafts included) can be edited from here (task G4). */}
          {tab === 'made' && isOwn ? (
            <Link
              to={`/trails/${trail.id}/edit`}
              className="btn btn--ghost btn--sm justify-self-end"
              aria-label={`Edit ${trail.title}`}
            >
              <Pencil aria-hidden />
              Edit
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

// ---- Card ------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  food_drink: 'Food & drink',
  outdoors: 'Outdoors',
  arts_culture: 'Arts & culture',
  shopping: 'Shopping',
  attractions: 'Attractions',
  affordable: 'Affordable',
  other: 'Other',
}

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** Style guide stats: "~$20 · 2 hr", "Free" when it costs nothing. */
function statsFor(trail: ProfileTrail): string[] {
  const stats: string[] = []
  if (trail.estimatedCost !== null) {
    stats.push(trail.estimatedCost === 0 ? 'Free' : `~$${Math.round(trail.estimatedCost)}`)
  }
  if (trail.durationMinutes !== null) {
    const m = trail.durationMinutes
    stats.push(m < 60 ? `${m} min` : `${Math.round((m / 60) * 2) / 2} hr`)
  }
  return stats
}

/**
 * Eyebrow text and status colour, per the style guide's card states:
 * finished = green, scheduled = blue, anytime = orange.
 */
function eyebrowFor(trail: ProfileTrail, tab: TrailTabId): { text: string; variant: 'done' | 'scheduled' | 'anytime' | 'draft' } {
  if (tab === 'finished') {
    return { text: trail.completedAt ? `Finished · ${dayFormat.format(new Date(trail.completedAt))}` : 'Finished', variant: 'done' }
  }
  if (trail.trailStatus === 'draft') return { text: 'Draft', variant: 'draft' }
  const category =
    trail.category === 'other' && trail.customCategory
      ? trail.customCategory
      : trail.category
        ? (CATEGORY_LABELS[trail.category] ?? null)
        : null
  return { text: category ?? 'Trail', variant: 'anytime' }
}

function ProfileTrailCard({ trail, tab }: { trail: ProfileTrail; tab: TrailTabId }) {
  const eyebrow = eyebrowFor(trail, tab)
  const stats = statsFor(trail)
  const meta =
    tab === 'finished' && trail.myRating !== null
      ? `You rated ${Math.round(trail.myRating * 10) / 10}`
      : trail.neighborhood
  return (
    <Link className={`trail-card profile-card profile-card--${eyebrow.variant}`} to={`/trails/${trail.id}`}>
      <div className="trail-card__head">
        <span className="trail-card__eyebrow">{eyebrow.text}</span>
        {meta && <span className="trail-card__meta">{meta}</span>}
      </div>
      <h3 className="trail-card__title">{trail.title}</h3>
      {stats.length > 0 && <p className="profile-card__stats">{stats.join(' · ')}</p>}
    </Link>
  )
}

// ---- Empty states ------------------------------------------------------------------

function EmptyTab({ tab, isOwn, name }: { tab: TrailTabId; isOwn: boolean; name: string }) {
  const copy: Record<TrailTabId, { title: string; text: string; cta: { to: string; label: string } }> = {
    finished: {
      title: 'No finished trails yet',
      text: 'Pick one from Explore and check off its crumbs. It shows up here when you’re done.',
      cta: { to: '/', label: 'Explore trails' },
    },
    made: isOwn
      ? {
          title: 'You haven’t made a trail yet',
          text: 'Share a route you love. It only takes two stops.',
          cta: { to: '/make', label: 'Make a trail' },
        }
      : {
          title: 'No trails yet',
          text: `${name} hasn’t published a trail.`,
          cta: { to: '/', label: 'Explore trails' },
        },
  }
  const { title, text, cta } = copy[tab]
  return (
    <div className="profile-empty">
      <img src={emptyTrail} alt="" width={240} height={160} />
      <h3 className="profile-empty__title">{title}</h3>
      <p>{text}</p>
      <Link className="btn" to={cta.to}>
        {cta.label}
      </Link>
    </div>
  )
}
