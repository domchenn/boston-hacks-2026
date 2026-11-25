/**
 * Edit your own trail (/trails/:id/edit): loads it into the Make a trail form
 * (MakeTrailForm) and saves with save_trail(p_trail, p_trail_id). Before saving it
 * says what the form can't keep (extra crumbs, stop descriptions…). A side panel
 * lets the creator Unpublish (back to draft) or Delete (with a confirm). Only the
 * creator can open it; logged out → /login?next=/trails/:id/edit.
 * Route: /trails/:id/edit · Owner: Gio
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { CircleAlert, EyeOff, LoaderCircle, Trash2 } from 'lucide-react'
import type { TrailDetail } from '@/lib/api/trails'
import { useSession } from '@/lib/useSession'
import {
  deleteTrail,
  draftFromTrail,
  editLosses,
  loadEditableTrail,
  unpublishTrail,
  type EditableTrail,
  type EditLosses,
  type LoadResult,
} from './edit-trail'
import { MakeTrailForm } from './MakeTrailPage'

export function EditTrailPage() {
  const { id = '' } = useParams()
  const { session, loading } = useSession()
  if (loading) return <Skeleton />
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(`/trails/${id}/edit`)}`} replace />
  return <EditTrail key={`${session.user.id}:${id}`} trailId={id} userId={session.user.id} />
}

function EditTrail({ trailId, userId }: { trailId: string; userId: string }) {
  const [result, setResult] = useState<LoadResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadEditableTrail(trailId, userId).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [trailId, userId, attempt])

  const reload = () => {
    setResult(null)
    setAttempt((n) => n + 1)
  }

  if (!result) return <Skeleton />
  if (result.status === 'not_found') {
    return (
      <Message title="This trail isn’t here">
        It may have been deleted.{' '}
        <Link to="/me?tab=made" className="font-semibold text-crumb-strong hover:text-crumb-deep">
          See your trails
        </Link>
      </Message>
    )
  }
  if (result.status === 'not_yours') {
    return (
      <Message title="Only the person who made this trail can edit it">
        <Link to={`/trails/${result.trail.id}`} className="btn btn--sm btn--secondary mt-2">
          Back to the trail
        </Link>
      </Message>
    )
  }
  if (result.status === 'error') {
    return (
      <Message title={result.message}>
        <button type="button" className="btn btn--sm btn--secondary mt-2" onClick={reload}>
          Try again
        </button>
      </Message>
    )
  }

  const { trail } = result.data
  const published = trail.status === 'published'
  return (
    <>
      <LossNotice trail={trail} losses={editLosses(trail)} />
      <MakeTrailForm
        // Remount with fresh values after Unpublish changes the trail's status.
        key={`${trail.id}:${trail.status}:${attempt}`}
        initialDraft={draftFromTrail(result.data)}
        trailId={trail.id}
        published={published}
        heading="Edit trail"
        subheading={
          published
            ? 'This trail is live. Changes show up for everyone when you save.'
            : 'This trail is a draft, so only you can see it. Publish it when it’s ready.'
        }
        aside={<ManagePanel data={result.data} onChanged={reload} />}
      />
    </>
  )
}

/** Says, before any save, what the editor can't keep. Shown only when something applies. */
function LossNotice({ trail, losses }: { trail: TrailDetail; losses: EditLosses }) {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const items: string[] = []
  if (losses.extraCrumbs > 0) items.push(`${plural(losses.extraCrumbs, 'extra crumb', 'extra crumbs')} (the editor keeps one crumb per stop)`)
  if (losses.betweenCrumbs > 0) items.push(`${plural(losses.betweenCrumbs, 'crumb', 'crumbs')} between stops`)
  if (losses.stopsWithDetails > 0) items.push(`the descriptions, planned activities and notes on ${plural(losses.stopsWithDetails, 'stop', 'stops')}`)
  if (losses.seeCrumbs > 0) items.push(`“See” labels on ${plural(losses.seeCrumbs, 'crumb', 'crumbs')} (they save as “Do”)`)
  const money = (n: number | null) => (n === null ? 'no cost' : n === 0 ? 'Free' : `~$${Math.round(n)}`)
  const cost = losses.costChange ? `The cost will be added up from the stops: ${money(losses.costChange.to)} instead of ${money(losses.costChange.from)}.` : null
  const ticks = trail.status === 'published' && trail.crumbCount > 0
  if (items.length === 0 && !cost && !losses.tooManyStops && !ticks) return null

  return (
    <div role="note" className="mb-5 rounded-card border border-line bg-white p-4 text-sm leading-normal text-ink-2 md:p-5">
      <p className="m-0 flex items-start gap-2 font-bold text-ink">
        <CircleAlert aria-hidden className="mt-0.5 size-4 flex-none text-crumb-deep" />
        Before you save
      </p>
      <ul className="mt-2 mb-0 list-disc space-y-1 pl-10">
        {items.length > 0 ? <li>Saving here will remove {items.join(', ')}.</li> : null}
        {losses.tooManyStops ? <li>This trail has more stops than the editor allows; remove some before saving.</li> : null}
        {cost ? <li>{cost}</li> : null}
        {ticks ? <li>Crumbs are saved fresh, so anyone partway through this trail will see their crumbs unticked.</li> : null}
      </ul>
    </div>
  )
}

/** Status, Unpublish and Delete. Delete asks first and says what goes with it. */
function ManagePanel({ data, onChanged }: { data: EditableTrail; onChanged: () => void }) {
  const { trail } = data
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'unpublish' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const published = trail.status === 'published'

  async function unpublish() {
    if (busy) return
    setBusy('unpublish')
    setError(null)
    const result = await unpublishTrail(trail.id)
    setBusy(null)
    if (result.ok) onChanged()
    else setError(result.message)
  }

  async function remove() {
    if (busy) return
    setBusy('delete')
    setError(null)
    const result = await deleteTrail(trail.id)
    if (result.ok) {
      navigate('/me?tab=made', { replace: true })
      return
    }
    setBusy(null)
    setError(result.message)
  }

  return (
    <section aria-labelledby="manage-title" className="rounded-card border border-line bg-white p-4 shadow-[var(--shadow-card)] md:p-5">
      <h2 id="manage-title" className="mb-1 text-md font-bold text-ink">
        Manage
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {published ? 'Published · everyone can find it.' : 'Draft · only you can see it.'}{' '}
        <Link to={`/trails/${trail.id}`} className="font-semibold text-crumb-strong hover:text-crumb-deep">
          View trail
        </Link>
      </p>

      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-crumb-tint px-3 py-2.5 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}

      {confirmDelete ? (
        <div role="group" aria-labelledby="delete-title" className="rounded-[12px] border border-line bg-paper p-3">
          <p id="delete-title" className="m-0 font-bold text-ink">
            Delete “{trail.title}”?
          </p>
          <p className="mt-1 mb-3 text-sm text-ink-2">
            This removes it for good: its stops and crumbs, plus everyone’s progress and ratings on it. It can’t be undone.
            {published ? ' To just hide it, unpublish it instead.' : ''}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn--sm btn--ink flex-1" onClick={remove} disabled={busy !== null}>
              {busy === 'delete' ? <LoaderCircle className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              Delete trail
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary flex-1"
              onClick={() => setConfirmDelete(false)}
              disabled={busy !== null}
              autoFocus
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {published ? (
            <button type="button" className="btn btn--sm btn--secondary" onClick={unpublish} disabled={busy !== null}>
              {busy === 'unpublish' ? <LoaderCircle className="animate-spin" aria-hidden /> : <EyeOff aria-hidden />}
              Unpublish
            </button>
          ) : null}
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
            <Trash2 aria-hidden />
            Delete
          </button>
        </div>
      )}
    </section>
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

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading trail" className="animate-pulse space-y-4">
      <div className="h-10 w-56 rounded-pill bg-sand" />
      <div className="h-4 w-72 rounded-pill bg-sand" />
      <div className="h-64 w-full rounded-card bg-sand" />
    </div>
  )
}
