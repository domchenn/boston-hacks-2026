/**
 * Back link and the full-page message box ("Trail not found", "Couldn't load…",
 * "Finish the trail first") shared by the Trail detail and Rate pages.
 */

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'

export function BackLink({ to = '/', label = 'All trails' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex h-10 items-center gap-1.5 text-base font-semibold text-ink-2 hover:text-ink">
      <ChevronLeft aria-hidden className="size-[18px]" />
      {label}
    </Link>
  )
}

/** A message in place of the page, with a back link above it. */
export function TrailMessage({
  title,
  children,
  backTo,
  backLabel,
}: {
  title: string
  children?: ReactNode
  backTo?: string
  backLabel?: string
}) {
  return (
    <div>
      <BackLink to={backTo} label={backLabel} />
      <div className="mt-4 rounded-card border border-dashed border-line-strong bg-white px-6 py-12 text-center">
        <p className="text-xl font-bold">{title}</p>
        <div className="mt-2 text-base text-ink-2">{children}</div>
      </div>
    </div>
  )
}
