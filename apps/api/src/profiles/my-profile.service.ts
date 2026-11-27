/**
 * The caller's editable profile fields (username, display name, university) for
 * onboarding, ported from the web's features/auth/onboarding-api.ts. The row comes
 * from the signup trigger, so this only reads and updates it, as the caller (RLS: your
 * own row only). A taken username is 409; values the database refuses are 422; a
 * missing profile is 404.
 */
import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { MyProfileBody, MyProfileFields } from '@breadcrumb/contracts'
import type { AuthUser } from '../auth/auth-user.js'
import { SupabaseClients } from '../supabase/supabase-clients.js'

type Row = { username: string | null; display_name: string | null; university: string | null }
const MISSING = 'We couldn’t find your profile. Log out and back in, then try again.'
const toFields = (row: Row): MyProfileFields => ({ username: row.username, displayName: row.display_name, university: row.university })

@Injectable()
export class MyProfileService {
  constructor(private readonly clients: SupabaseClients) {}

  async get(user: AuthUser): Promise<MyProfileFields> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('profiles')
      .select('username, display_name, university')
      .eq('id', user.id)
      .returns<Row[]>()
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException(MISSING)
    return toFields(data)
  }

  /** Saves the fields; blank display name / university are stored as null. */
  async update(body: MyProfileBody, user: AuthUser): Promise<MyProfileFields> {
    const { data, error } = await this.clients
      .forUser(user)
      .from('profiles')
      .update({ username: body.username, display_name: body.displayName.trim() || null, university: body.university.trim() || null })
      .eq('id', user.id)
      .select('username, display_name, university')
      .returns<Row[]>()
    if (error?.code === '23505') throw new ConflictException('That username is taken. Try another one.')
    if (error?.code === '23514') throw new UnprocessableEntityException('Some of those details aren’t allowed. Check each field and try again.')
    if (error) throw error
    if (data.length === 0) throw new NotFoundException(MISSING)
    return toFields(data[0]!)
  }
}
