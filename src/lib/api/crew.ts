/**
 * Original Crew (the add_original_crew migration): friends the creator tagged as
 * being there the first time the trail was done. Tagged friends accept or
 * decline; accepted crew show on the trail page and on their profile. RLS shows
 * accepted crew to anyone who can see the trail, and pending / declined tags only
 * to the creator and the tagged person, so getTrailCrew returns the right set
 * for whoever is looking.
 *
 * Used by: Make / Edit a trail (tag friends), Trail detail (Original crew and
 * the "you were tagged" request), Explore → Friends (requests), Profile.
 */

import { supabase } from '@/lib/supabase'
import type { TrailCreator } from '@/lib/api/trails'

export type CrewStatus = 'pending' | 'accepted' | 'declined'
export type CrewMember = { person: TrailCreator; status: CrewStatus }
export type CrewRequest = { trailId: string; trailTitle: string; from: TrailCreator | null; taggedAt: string }

const PERSON = 'id, username, display_name, avatar_url'

function fail(error: { code?: string; message?: string } | null): Error {
  if (!error?.code) return new Error('We couldn’t reach Breadcrumb. Check your connection and try again.')
  if (error.code === 'P0002') return new Error('That tag isn’t there any more.')
  return new Error('Something went wrong. Please try again.')
}

/** The crew of a trail you can see (accepted for everyone; the creator and the tagged person also see pending). */
export async function getTrailCrew(trailId: string): Promise<CrewMember[]> {
  const { data, error } = await supabase
    .from('trail_crew')
    .select(`status, created_at, person:profiles!trail_crew_user_id_fkey(${PERSON})`)
    .eq('sidequest_id', trailId)
    .order('created_at')
  if (error) throw fail(error)
  return (data ?? [])
    .filter((r): r is typeof r & { person: TrailCreator } => r.person !== null)
    .map((r) => ({ person: r.person, status: r.status as CrewStatus }))
}

/** Creator only: the trail's whole crew list (new tags start pending; existing answers are kept). */
export async function setTrailCrew(trailId: string, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_trail_crew', { p_sidequest_id: trailId, p_user_ids: userIds })
  if (error) throw fail(error)
}

/** Accept or decline being on a trail's crew. */
export async function respondToCrew(trailId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_crew', { p_sidequest_id: trailId, p_accept: accept })
  if (error) throw fail(error)
}

/** Take yourself off a trail's crew. */
export async function leaveCrew(trailId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('trail_crew').delete().eq('sidequest_id', trailId).eq('user_id', userId)
  if (error) throw fail(error)
}

/** Tags waiting for your answer, newest first. */
export async function getMyCrewRequests(userId: string): Promise<CrewRequest[]> {
  const { data, error } = await supabase
    .from('trail_crew')
    .select(
      `sidequest_id, created_at, from:profiles!trail_crew_added_by_fkey(${PERSON}), trail:sidequests!inner(title, status)`,
    )
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw fail(error)
  return (data ?? []).map((r) => ({
    trailId: r.sidequest_id,
    trailTitle: r.trail.title,
    from: r.from,
    taggedAt: r.created_at,
  }))
}

/** Ids of trails someone is on the Original Crew of (accepted), newest first. */
export async function getCrewTrailIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('trail_crew')
    .select('sidequest_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw fail(error)
  return (data ?? []).map((r) => r.sidequest_id)
}
