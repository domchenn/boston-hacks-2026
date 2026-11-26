/**
 * Communities (M15a), ported from the web's features/communities/api.ts: the list
 * (communities without a slug are left out) and setting the caller's own
 * profiles.community_id (null = none). Runs as the caller, so RLS lets you update
 * only your own profile; an unknown community id is a 422.
 */
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { Community } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

@Injectable()
export class CommunitiesService {
  constructor(private readonly clients: SupabaseClients) {}

  async list(user: AuthUser | null): Promise<Community[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('communities')
      .select('id, name, slug')
      .order('name')
      .returns<{ id: string; name: string; slug: string | null }[]>()
    if (error) throw error
    return data.filter((c): c is Community => c.slug !== null)
  }

  /** Joins a community, or leaves by passing null. */
  async setMine(communityId: string | null, user: AuthUser): Promise<string | null> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('profiles')
      .update({ community_id: communityId })
      .eq('id', user.id)
      .select('community_id')
      .returns<{ community_id: string | null }[]>()
    if (error?.code === '23503') throw new UnprocessableEntityException('That community doesn’t exist anymore.')
    if (error) throw error
    if (data.length === 0) throw new NotFoundException('Profile not found.')
    return data[0]!.community_id
  }
}
