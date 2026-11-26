/**
 * /admin/reports: the moderation queue for team accounts (profiles.is_admin).
 * Lists open reports newest first with a preview of what was reported (trail
 * title, review text or photo) and two actions: Hide (archive the trail /
 * remove the review or photo) and Dismiss. Everyone else sees "not found".
 * Make someone an admin in the Supabase SQL editor:
 *   update profiles set is_admin = true where username = '…';
 * Route: /admin/reports · Owner: Dom (task D8)
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '@/lib/useSession'
import { REPORT_REASONS, isCurrentUserAdmin, listOpenReports, resolveReport, type OpenReport } from './api'

const reasonLabel = (value: string) => REPORT_REASONS.find((r) => r.value === value)?.label ?? value

export function AdminReportsPage() {
  const { session, loading } = useSession()
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [reports, setReports] = useState<OpenReport[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    let cancelled = false
    ;(session ? isCurrentUserAdmin() : Promise.resolve(false)).then((yes) => !cancelled && setAdmin(yes))
    return () => {
      cancelled = true
    }
  }, [session, loading])

  const load = useCallback(() => {
    listOpenReports().then(setReports, () => setError('Couldn’t load reports.'))
  }, [])

  useEffect(() => {
    if (admin) load()
  }, [admin, load])

  async function act(report: OpenReport, action: 'hide' | 'dismiss') {
    setBusyId(report.id)
    setError(null)
    try {
      await resolveReport(report, action)
      setReports((list) => list?.filter((r) => !(r.targetType === report.targetType && r.targetId === report.targetId)) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading || admin === null) return null
  if (!admin) {
    return (
      <section className="py-16 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <Link to="/" className="mt-4 inline-block font-semibold text-crumb-strong">
          Back to Explore
        </Link>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[2rem] font-extrabold tracking-[var(--tracking-title)]">Reports</h1>
      <p className="mt-1 text-base text-ink-2">Open reports from users, newest first.</p>
      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-crumb-tint px-4 py-3 text-sm text-crumb-deep">
          {error}
        </p>
      ) : null}

      {reports === null ? (
        <p className="mt-6 text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-6 rounded-card border border-dashed border-line-strong bg-white px-6 py-10 text-center text-ink-2">
          No open reports. 🎉
        </p>
      ) : (
        <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
          {reports.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 font-bold">
                  {r.targetType === 'trail' ? 'Trail' : r.targetType === 'review' ? 'Review' : 'Photo'} ·{' '}
                  <span className="font-semibold text-crumb-strong">{reasonLabel(r.reason)}</span>
                </p>
                <span className="text-sm text-muted-foreground">
                  {r.reporter ? `@${r.reporter}` : 'Someone'} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              {r.note ? <p className="mt-2 mb-0 text-base text-ink-2">“{r.note}”</p> : null}

              <div className="mt-3 rounded-[10px] bg-paper p-3 text-sm">
                {r.preview === null ? (
                  <span className="text-muted-foreground">This item no longer exists.</span>
                ) : r.preview.imageUrl ? (
                  <img src={r.preview.imageUrl} alt="Reported photo" className="max-h-48 rounded-[8px] object-cover" />
                ) : r.preview.title ? (
                  <span className="font-semibold">{r.preview.title}</span>
                ) : (
                  <span>{r.preview.text || '(rating with no written review)'}</span>
                )}
                {r.preview?.trailId ? (
                  <Link to={`/trails/${r.preview.trailId}`} className="ml-2 font-semibold text-crumb-strong">
                    Open trail
                  </Link>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn--sm" onClick={() => act(r, 'hide')} aria-disabled={busyId === r.id}>
                  {r.targetType === 'trail' ? 'Hide trail' : r.targetType === 'review' ? 'Remove review' : 'Remove photo'}
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--secondary"
                  onClick={() => act(r, 'dismiss')}
                  aria-disabled={busyId === r.id}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
