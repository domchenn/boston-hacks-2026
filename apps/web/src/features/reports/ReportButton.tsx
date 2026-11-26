/**
 * "Report" link that opens a small dialog (reason + optional note) and sends a
 * report through reportContent(). Hidden on your own content; logged-out users
 * get a link to log in. `tone="dark"` is for use over photos (white text).
 * Used on Trail detail (the trail), review cards and the photo viewer (task D8).
 */

import { useRef, useState } from 'react'
import { Flag } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useSession } from '@/lib/useSession'
import { cn } from '@/lib/utils'
import { REPORT_REASONS, reportContent, type ReportReason, type ReportTarget } from './api'

type ReportButtonProps = {
  targetType: ReportTarget
  targetId: string
  /** The author's user id; the button is hidden on your own content. */
  ownerId?: string | null
  /** Shown in the dialog, e.g. "this trail", "this review". */
  what?: string
  tone?: 'light' | 'dark'
  className?: string
}

export function ReportButton({ targetType, targetId, ownerId, what, tone = 'light', className }: ReportButtonProps) {
  const { session } = useSession()
  const location = useLocation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const label = what ?? `this ${targetType}`

  if (ownerId && session?.user.id === ownerId) return null

  const linkClass = cn(
    'inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-medium hover:underline',
    tone === 'dark' ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-ink',
    className,
  )

  if (!session) {
    return (
      <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className={linkClass}>
        <Flag aria-hidden className="size-3.5" />
        Report
      </Link>
    )
  }

  async function submit() {
    if (!reason || state === 'sending') return
    setState('sending')
    setError(null)
    const result = await reportContent(targetType, targetId, reason, note)
    if (result.ok) setState('sent')
    else {
      setState('idle')
      setError(result.message)
    }
  }

  return (
    <>
      <button type="button" className={linkClass} onClick={() => dialogRef.current?.showModal()}>
        <Flag aria-hidden className="size-3.5" />
        Report
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`report-${targetId}`}
        className="m-auto w-[min(440px,calc(100%-2rem))] rounded-card border border-line bg-white p-5 text-ink shadow-[var(--shadow-float)] backdrop:bg-black/40"
        onClose={() => {
          if (state === 'sent') {
            setReason(null)
            setNote('')
          }
        }}
      >
        {state === 'sent' ? (
          <div>
            <h2 id={`report-${targetId}`} className="m-0 text-lg font-bold">
              Thanks for letting us know
            </h2>
            <p className="mt-2 text-base text-ink-2">We'll take a look at {label}.</p>
            <button type="button" className="btn btn--sm mt-4" onClick={() => dialogRef.current?.close()}>
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <h2 id={`report-${targetId}`} className="m-0 text-lg font-bold">
              Report {label}
            </h2>
            <fieldset className="mt-3 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 text-sm font-semibold text-ink-2">What's wrong?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-center gap-2 text-base">
                  <input type="radio" name={`reason-${targetId}`} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm font-semibold text-ink-2">
              Anything else? (optional)
              <textarea
                className="mt-1 block min-h-16 w-full rounded-[10px] border border-line-strong px-3 py-2 text-base font-normal text-ink outline-none focus:shadow-[var(--focus-ring)]"
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error ? (
              <p role="alert" className="mt-2 text-sm text-crumb-deep">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn--sm btn--secondary" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn--sm" aria-disabled={!reason || state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}
