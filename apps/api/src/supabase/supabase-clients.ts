/**
 * Supabase clients that act as the caller: the publishable key plus, when signed in,
 * the caller's own access token. Postgres RLS therefore decides what every query may
 * see, exactly as it does for the web app. The API never holds a secret or
 * service-role key, so it cannot read more than the caller could.
 */
import { Inject, Injectable } from '@nestjs/common'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthUser } from '../auth/auth-user.js'
import { APP_CONFIG, type AppConfig } from '../config/env.js'

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const

@Injectable()
export class SupabaseClients {
  private readonly anon: SupabaseClient

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.anon = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, { auth: NO_SESSION })
  }

  /** A client scoped to this caller: their token when signed in, the anon role otherwise. */
  forUser(user: AuthUser | null): SupabaseClient {
    if (!user) return this.anon
    return createClient(this.config.SUPABASE_URL, this.config.SUPABASE_PUBLISHABLE_KEY, {
      auth: NO_SESSION,
      global: { headers: { Authorization: `Bearer ${user.accessToken}` } },
    })
  }
}
