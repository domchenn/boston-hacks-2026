/**
 * "This is your trail" bar with an Edit trail button, shown to the creator on
 * Trail detail (and a Draft badge when it isn't published yet). Renders nothing
 * for anyone else. Part of task G4 (Edit trail).
 */
import { Pencil } from 'lucide-react'
import { Link } from 'react-router'
import { useSession } from '@/lib/useSession'
import type { SidequestStatus } from '@/types/db-values'

export function YourTrailBar({ trailId, creatorId, status }: { trailId: string; creatorId: string | null; status: SidequestStatus }) {
  const { session } = useSession()
  if (!session || !creatorId || session.user.id !== creatorId) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-white px-4 py-2.5">
      {status === 'draft' ? (
        <span className="rounded-pill bg-sand px-2.5 py-0.5 text-sm font-semibold text-ink-2">Draft · only you can see it</span>
      ) : (
        <span className="text-sm font-semibold text-ink-2">This is your trail</span>
      )}
      <Link to={`/trails/${trailId}/edit`} className="btn btn--sm btn--secondary ml-auto">
        <Pencil aria-hidden />
        Edit trail
      </Link>
    </div>
  )
}
