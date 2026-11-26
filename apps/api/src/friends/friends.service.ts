/**
 * Follows, friends, close friends and the private-account switch (M15b), ported from
 * the web's features/friends/api.ts with the same queries, run as the caller. RLS
 * keeps the rules: you follow and unfollow only as yourself, only you read your close
 * friends list, and only friends (mutual follows) can be added to it (refused → 403).
 * Following yourself is a 422; an unknown person is a 404. Repeating a follow or a
 * close-friend add is fine.
 */
import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { FollowCounts, Relationship, TrailCreator } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type DbError = { code?: string; message?: string }
const PERSON = 'id, username, display_name, avatar_url'
/** The web's cap on follower / following lists. */
const LIST_LIMIT = 500

function fail(error: DbError): never {
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

const byName = (a: TrailCreator, b: TrailCreator) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '')

@Injectable()
export class FriendsService {
  constructor(private readonly clients: SupabaseClients) {}

  async followCounts(userId: string, user: AuthUser | null): Promise<FollowCounts> {
    const db = this.clients.forUser(user)
    const [followers, following] = await Promise.all([
      db.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
      db.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
    ])
    if (followers.error) fail(followers.error)
    if (following.error) fail(following.error)
    return { followers: followers.count ?? 0, following: following.count ?? 0 }
  }

  /** Who follows `userId` ('followers') or whom they follow ('following'), newest first. */
  async followList(userId: string, kind: 'followers' | 'following', user: AuthUser | null): Promise<TrailCreator[]> {
    const db = this.clients.forUser(user)
    const query =
      kind === 'followers'
        ? db.from('follows').select(`created_at, person:profiles!follows_follower_id_fkey(${PERSON})`).eq('following_id', userId)
        : db.from('follows').select(`created_at, person:profiles!follows_following_id_fkey(${PERSON})`).eq('follower_id', userId)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT)
      .returns<{ person: TrailCreator | null }[]>()
    if (error) fail(error)
    return data.map((r) => r.person).filter((p): p is TrailCreator => p !== null)
  }

  async followingIds(user: AuthUser): Promise<string[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .returns<{ following_id: string }[]>()
    if (error) fail(error)
    return data.map((r) => r.following_id)
  }

  /** Follow (idempotent) or unfollow. */
  async setFollowing(userId: string, on: boolean, user: AuthUser): Promise<boolean> {
    const db = this.clients.forUser(user)
    const { error } = on
      ? await db.from('follows').insert({ follower_id: user.id, following_id: userId })
      : await db.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId)
    if (!error || error.code === '23505') return on
    if (error.code === '23514') throw new UnprocessableEntityException('You can’t follow yourself.')
    if (error.code === '23503') throw new NotFoundException('This person isn’t on Breadcrumb anymore.')
    fail(error)
  }

  async relationship(userId: string, user: AuthUser): Promise<Relationship> {
    // Both ids are validated uuids, so they're safe inside the filter string.
    const { data, error } = await this.clients
      .forUser(user)
      .from('follows')
      .select('follower_id, following_id')
      .or(`and(follower_id.eq.${user.id},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${user.id})`)
      .returns<{ follower_id: string; following_id: string }[]>()
    if (error) fail(error)
    return {
      following: data.some((r) => r.follower_id === user.id && r.following_id === userId),
      followsYou: data.some((r) => r.follower_id === userId && r.following_id === user.id),
    }
  }

  /** People you follow who follow you back, A to Z by name. */
  async friends(user: AuthUser): Promise<TrailCreator[]> {
    const db = this.clients.forUser(user)
    const [mine, theirs] = await Promise.all([
      db
        .from('follows')
        .select(`person:profiles!follows_following_id_fkey(${PERSON})`)
        .eq('follower_id', user.id)
        .returns<{ person: TrailCreator | null }[]>(),
      db.from('follows').select('follower_id').eq('following_id', user.id).returns<{ follower_id: string }[]>(),
    ])
    if (mine.error) fail(mine.error)
    if (theirs.error) fail(theirs.error)
    const followers = new Set(theirs.data.map((r) => r.follower_id))
    return mine.data
      .map((r) => r.person)
      .filter((p): p is TrailCreator => p !== null && followers.has(p.id))
      .sort(byName)
  }

  async closeFriendIds(user: AuthUser): Promise<string[]> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('close_friends')
      .select('friend_id')
      .eq('owner_id', user.id)
      .returns<{ friend_id: string }[]>()
    if (error) fail(error)
    return data.map((r) => r.friend_id)
  }

  /** Add (idempotent; friends only) or remove someone on your close friends list. */
  async setCloseFriend(userId: string, on: boolean, user: AuthUser): Promise<boolean> {
    const db = this.clients.forUser(user)
    const { error } = on
      ? await db.from('close_friends').insert({ owner_id: user.id, friend_id: userId })
      : await db.from('close_friends').delete().eq('owner_id', user.id).eq('friend_id', userId)
    if (!error || error.code === '23505') return on
    if (error.code === '42501') throw new ForbiddenException('Only friends (people who follow you back) can be close friends.')
    if (error.code === '23503') throw new NotFoundException('This person isn’t on Breadcrumb anymore.')
    fail(error)
  }

  async setPrivate(isPrivate: boolean, user: AuthUser): Promise<boolean> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('profiles')
      .update({ is_private: isPrivate })
      .eq('id', user.id)
      .select('is_private')
      .returns<{ is_private: boolean }[]>()
    if (error) fail(error)
    if (data.length === 0) throw new NotFoundException('Profile not found.')
    return data[0]!.is_private
  }
}
