/**
 * Outings: one run of a trail, alone or with friends (the add_outings migration).
 * A trail is the reusable plan; each time someone does it is an outing with its
 * own SHARED checklist (outing_checks), so friends on the same outing see each
 * other's ticks, and "Do it again" starts a fresh outing instead of reopening the
 * old one. Finished outings are kept as history.
 *
 * Writes go through the database functions (start_outing, invite_to_outing,
 * respond_to_outing, leave_outing, finish_outing), which also keep the user's
 * user_sidequests summary in step; ticks are written directly under RLS.
 * subscribeToOuting keeps everyone's screen in sync with a Realtime broadcast
 * ping (no data in it: each phone re-reads through RLS) plus a slow poll.
 *
 * Used by: Active trail, Trail detail (Continue / Do it again, your outings,
 * invites) and Explore → Friends (outing invites).
 */

import { supabase } from '@/lib/supabase'
import type { TrailCreator } from '@/lib/api/trails'

export type OutingStatus = 'active' | 'completed' | 'ended'
export type OutingMemberStatus = 'invited' | 'joined' | 'declined' | 'left'

export type OutingMember = { person: TrailCreator; status: OutingMemberStatus }

export type Outing = {
  id: string
  trailId: string
  hostId: string | null
  status: OutingStatus
  startedAt: string
  completedAt: string | null
  members: OutingMember[]
}

export type OutingInvite = {
  outingId: string
  trailId: string
  trailTitle: string
  from: TrailCreator | null
  invitedAt: string
}

const PERSON = 'id, username, display_name, avatar_url'
const OUTING_SELECT = `id, sidequest_id, host_id, status, started_at, completed_at, outing_members(status, person:profiles!outing_members_user_id_fkey(${PERSON}))`

type OutingRow = {
  id: string
  sidequest_id: string
  host_id: string | null
  status: string
  started_at: string
  completed_at: string | null
  outing_members: { status: string; person: TrailCreator | null }[]
}

/** Errors with a message ready to show. */
export class OutingError extends Error {
  readonly code: 'not_signed_in' | 'network' | 'gone' | 'unknown'
  constructor(code: OutingError['code'], message: string) {
    super(message)
    this.name = 'OutingError'
    this.code = code
  }
}

function toError(error: { code?: string; message?: string } | null): OutingError {
  const code = error?.code ?? ''
  if (!code) return new OutingError('network', 'We couldn’t reach Breadcrumb. Check your connection and try again.')
  if (code === 'PGRST301' || code === 'PGRST303')
    return new OutingError('not_signed_in', 'Log in to keep track of your trails.')
  if (code === 'P0002') return new OutingError('gone', 'That invite isn’t open any more.')
  if (code === '42501' || code === '23503') return new OutingError('gone', 'This outing isn’t available any more.')
  return new OutingError('unknown', 'Something went wrong. Please try again.')
}

/** Runs a query; turns failures (including no network) into an OutingError. */
async function run<T>(
  query: PromiseLike<{
    data: T
    error: { code?: string; message?: string } | null
  }>,
): Promise<T> {
  let result: { data: T; error: { code?: string; message?: string } | null }
  try {
    result = await query
  } catch {
    throw toError(null)
  }
  if (result.error) throw toError(result.error)
  return result.data
}

function toOuting(row: OutingRow): Outing {
  return {
    id: row.id,
    trailId: row.sidequest_id,
    hostId: row.host_id,
    status: row.status as OutingStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    members: row.outing_members
      .filter((m): m is { status: string; person: TrailCreator } => m.person !== null)
      .map((m) => ({
        person: m.person,
        status: m.status as OutingMemberStatus,
      })),
  }
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** One outing with who's on it. */
export async function getOuting(outingId: string): Promise<Outing | null> {
  const row = await run(supabase.from('outings').select(OUTING_SELECT).eq('id', outingId).maybeSingle())
  return row ? toOuting(row as OutingRow) : null
}

/** Your outings of a trail (any status you were on), newest first. Empty when logged out. */
export async function getMyOutings(trailId: string): Promise<Outing[]> {
  const userId = await myId()
  if (!userId) return []
  // RLS only returns outings you're on; keep the ones you actually went on (not just invited to).
  const rows = await run(
    supabase
      .from('outings')
      .select(OUTING_SELECT)
      .eq('sidequest_id', trailId)
      .order('started_at', { ascending: false })
      .limit(50),
  )
  return ((rows ?? []) as OutingRow[])
    .map(toOuting)
    .filter((o) => o.members.some((m) => m.person.id === userId && (m.status === 'joined' || m.status === 'left')))
}

/** The outing you're on right now for a trail, if any. */
export async function getMyActiveOuting(trailId: string): Promise<Outing | null> {
  const userId = await myId()
  if (!userId) return null
  const outings = await getMyOutings(trailId)
  return (
    outings.find(
      (o) => o.status === 'active' && o.members.some((m) => m.person.id === userId && m.status === 'joined'),
    ) ?? null
  )
}

/** Open invites to you: active outings a friend asked you on. Newest first. */
export async function getMyOutingInvites(trailId?: string): Promise<OutingInvite[]> {
  const userId = await myId()
  if (!userId) return []
  let query = supabase
    .from('outing_members')
    .select(
      `outing_id, created_at, inviter:profiles!outing_members_invited_by_fkey(${PERSON}), outing:outings!inner(sidequest_id, status, trail:sidequests!inner(title))`,
    )
    .eq('user_id', userId)
    .eq('status', 'invited')
    .eq('outing.status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)
  if (trailId) query = query.eq('outing.sidequest_id', trailId)
  const rows = await run(query)
  return (rows ?? []).map((r) => ({
    outingId: r.outing_id,
    trailId: r.outing.sidequest_id,
    trailTitle: r.outing.trail.title,
    from: r.inviter,
    invitedAt: r.created_at,
  }))
}

/** Crumb id → who ticked it, on an outing's shared checklist. */
export async function getOutingTicks(outingId: string): Promise<Map<string, string | null>> {
  const rows = await run(
    supabase.from('outing_checks').select('checklist_item_id, checked_by').eq('outing_id', outingId),
  )
  return new Map((rows ?? []).map((r) => [r.checklist_item_id, r.checked_by]))
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Start doing a trail now, or resume the outing you're on. After a finished one this starts fresh. */
export async function startOuting(trailId: string): Promise<string> {
  if (!(await myId())) throw new OutingError('not_signed_in', 'Log in to keep track of your trails.')
  const id = await run(supabase.rpc('start_outing', { p_sidequest_id: trailId }))
  if (!id) throw toError({ code: 'unknown' })
  return id
}

/** Tick or untick a crumb on the outing's shared checklist. */
export async function setOutingCrumb(outingId: string, crumbId: string, done: boolean): Promise<void> {
  if (done) {
    await run(
      supabase
        .from('outing_checks')
        .upsert(
          { outing_id: outingId, checklist_item_id: crumbId },
          { onConflict: 'outing_id,checklist_item_id', ignoreDuplicates: true },
        ),
    )
  } else {
    await run(supabase.from('outing_checks').delete().eq('outing_id', outingId).eq('checklist_item_id', crumbId))
  }
}

/** Invite friends (mutual follows) to an outing you're on. Returns how many were invited. */
export async function inviteToOuting(outingId: string, userIds: string[]): Promise<number> {
  return (
    (await run(
      supabase.rpc('invite_to_outing', {
        p_outing_id: outingId,
        p_user_ids: userIds,
      }),
    )) ?? 0
  )
}

/** Accept or decline an invite. */
export async function respondToOuting(outingId: string, accept: boolean): Promise<void> {
  await run(
    supabase.rpc('respond_to_outing', {
      p_outing_id: outingId,
      p_accept: accept,
    }),
  )
}

/** Leave an outing ("Stop"). The last one out ends it. */
export async function leaveOuting(outingId: string): Promise<void> {
  await run(supabase.rpc('leave_outing', { p_outing_id: outingId }))
}

/** Finish the outing for everyone on it (unlocks rating). */
export async function finishOuting(outingId: string): Promise<void> {
  await run(supabase.rpc('finish_outing', { p_outing_id: outingId }))
}

// ---------------------------------------------------------------------------
// Live sync
// ---------------------------------------------------------------------------

const POLL_MS = 15_000

/**
 * Calls onChange when someone on the outing ticks, joins, leaves or finishes.
 * Returns { ping, stop }: call ping() after your own change so the others update.
 * Also re-checks every 15 s and when the tab comes back, in case a ping was missed.
 */
export function subscribeToOuting(outingId: string, onChange: () => void) {
  const channel = supabase.channel(`outing:${outingId}`, {
    config: { broadcast: { self: false } },
  })
  channel.on('broadcast', { event: 'changed' }, () => onChange()).subscribe()
  const poll = setInterval(() => document.visibilityState === 'visible' && onChange(), POLL_MS)
  const onVisible = () => document.visibilityState === 'visible' && onChange()
  document.addEventListener('visibilitychange', onVisible)
  return {
    ping: () => void channel.send({ type: 'broadcast', event: 'changed', payload: {} }),
    stop: () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    },
  }
}
