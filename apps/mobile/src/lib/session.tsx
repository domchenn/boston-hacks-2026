/**
 * Who is signed in, for the whole app. Reads the stored session at start, follows
 * sign-in / sign-out / token refreshes, and loads the profile fields (username) from
 * the API, so screens can send people without a username to onboarding. Email and
 * password only for now; Google and Sign in with Apple come later. Messages match the
 * website's sign-in page.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import type { MyProfileFields } from '@breadcrumb/contracts'
import { api } from './api'
import { supabase } from './supabase'

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string }

type SessionState = {
  /** True until the stored session has been read. */
  loading: boolean
  session: Session | null
  /** The caller's username and display name; null while loading or signed out. */
  profile: MyProfileFields | null
  /** True while a signed-in person's profile is still loading. */
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

/** The caller's profile fields from the API; null if it can't be read (never throws). */
async function readProfile(): Promise<MyProfileFields | null> {
  try {
    return api ? await api.getMyProfile() : null
  } catch {
    return null
  }
}

const NOT_SET_UP = 'The app isn’t set up for signing in yet.'
const NETWORK = 'We couldn’t reach Breadcrumb. Check your connection and try again.'

function friendly(error: { message?: string; code?: string; status?: number }): string {
  const code = error.code ?? ''
  if (code === 'invalid_credentials') return 'That email and password don’t match. Try again.'
  if (code === 'email_not_confirmed') return 'Confirm your email first: open the link we sent you, then log in.'
  if (code === 'user_already_exists' || code === 'email_exists') return 'There’s already an account with that email. Log in instead.'
  if (code === 'weak_password') return 'Use a longer password (at least 8 characters).'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many tries. Wait a minute and try again.'
  if (!error.status) return NETWORK
  return error.message || 'Something went wrong. Please try again.'
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(Boolean(supabase))
  const [session, setSession] = useState<Session | null>(null)
  /** The profile and whose it is, so a stale profile is never shown for another account. */
  const [loaded, setLoaded] = useState<{ userId: string; fields: MyProfileFields | null } | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    // Refresh tokens only while the app is open (Supabase's guidance for React Native).
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase?.auth.startAutoRefresh()
      else supabase?.auth.stopAutoRefresh()
    })
    return () => {
      data.subscription.unsubscribe()
      appState.remove()
    }
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    readProfile().then((fields) => !cancelled && setLoaded({ userId, fields }))
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (userId) setLoaded({ userId, fields: await readProfile() })
  }, [userId])

  const profile = userId && loaded?.userId === userId ? loaded.fields : null
  const profileLoading = Boolean(userId) && loaded?.userId !== userId

  const value = useMemo<SessionState>(
    () => ({
      loading,
      session,
      profile,
      profileLoading,
      refreshProfile,
      async signIn(email, password) {
        if (!supabase) return { ok: false, message: NOT_SET_UP }
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        return error ? { ok: false, message: friendly(error) } : { ok: true }
      },
      async signUp(email, password) {
        if (!supabase) return { ok: false, message: NOT_SET_UP }
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) return { ok: false, message: friendly(error) }
        // No session back means the project asks people to confirm their email first.
        return { ok: true, needsConfirmation: !data.session }
      },
      async signOut() {
        await supabase?.auth.signOut()
        setLoaded(null)
      },
    }),
    [loading, session, profile, profileLoading, refreshProfile],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionState {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession() must be used inside <SessionProvider> (see src/app/_layout.tsx)')
  return value
}
