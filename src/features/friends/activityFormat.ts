/**
 * Small text helpers for friends' activity: "2 d" style ages and the verb for
 * each kind ("@maya_k finished …"). Used by FriendsActivity and FriendsPanel.
 */

import { formatShortDate } from '@/components/trailFormat'
import type { TrailCreator } from '@/lib/api/trails'
import type { ActivityKind } from './api'

export const ACTIVITY_VERBS: Record<ActivityKind, string> = {
  made: 'made',
  finished: 'finished',
  joined: 'joined',
}

/** "just now", "5 min", "3 h", "2 d", then the date ("Nov 2") after a month. */
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d`
  return formatShortDate(iso)
}

/** "@maya_k", or their display name if they have no username yet. */
export function handle(person: TrailCreator) {
  return person.username ? `@${person.username}` : person.display_name || 'Someone'
}
