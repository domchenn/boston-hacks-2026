/**
 * Shape of the shared login state, and the React context that carries it.
 * Filled by <SessionProvider> (SessionProvider.tsx); read it with useSession()
 * (useSession.ts). Kept in its own file so those two files stay small.
 */

import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Tables } from '@/types/database.types'

/** The signed-in user's public profile fields that the UI needs. */
export type SessionProfile = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'avatar_url'>

export type SessionState = {
  /** Supabase session, or null when logged out. */
  session: Session | null
  /** The user's row in `profiles`, or null when logged out or still loading. */
  profile: SessionProfile | null
  /** True until the first session check finishes. Don't redirect while this is true. */
  loading: boolean
  /** Logs out everywhere in the app. */
  signOut: () => Promise<void>
  /** Re-reads the profile, e.g. after onboarding sets a username. */
  refreshProfile: () => Promise<void>
}

export const SessionContext = createContext<SessionState | null>(null)
