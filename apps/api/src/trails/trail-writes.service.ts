/**
 * Creating and editing trails (M13) through the database function save_trail(),
 * called as the signed-in user. save_trail() does everything in one transaction:
 * the publish checklist, the community and visibility rules, remix checks, and
 * replacing the stops and crumbs. So the API adds no rules of its own; it maps
 * the function's errors to HTTP statuses and passes its friendly messages on:
 *
 *   23514 (a rule like "Add at least 2 stops before publishing") → 422
 *   22023 (a bad value)                                          → 400
 *   42501 (not yours, not your community, can't see the remix)   → 403
 *   23503 (a referenced place or community no longer exists)    → 422
 */
import { BadRequestException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common'
import type { SaveTrailBody } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type DbError = { code?: string; message?: string }

function rethrow(error: DbError): never {
  const message = error.message ?? 'This trail couldn’t be saved.'
  switch (error.code) {
    case '23514':
      throw new UnprocessableEntityException(message)
    case '22023':
    case '22P02':
      throw new BadRequestException(message)
    case '42501':
      throw new ForbiddenException(message)
    case '23503':
      throw new UnprocessableEntityException('Something this trail points to no longer exists. Refresh and try again.')
    default:
      throw Object.assign(new Error(error.message ?? 'save_trail failed'), { code: error.code })
  }
}

@Injectable()
export class TrailWritesService {
  constructor(private readonly clients: SupabaseClients) {}

  /** Creates (id null) or replaces (id set) the caller's trail; returns its id. */
  async save(body: SaveTrailBody, id: string | null, user: AuthUser): Promise<{ id: string }> {
    const { data, error } = await this.clients
      .forUser(user)
      .rpc('save_trail', { p_trail: body, ...(id ? { p_trail_id: id } : {}) })
    if (error) rethrow(error)
    return { id: data as string }
  }
}
