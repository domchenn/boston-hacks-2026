/**
 * Email/password auth for the auth lane. Thin wrappers over the shared Supabase
 * client that turn Supabase's responses into the three outcomes the UI cares
 * about, with plain-language error messages.
 *
 * Nothing here assumes how the project is configured: whether a session comes
 * back from signUp (email confirmation off) or not (confirmation on) is read
 * from the response itself.
 */
import { isAuthApiError, isAuthRetryableFetchError, isAuthWeakPasswordError, type AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Credentials = { email: string; password: string }

export type AuthResult =
  /** A session exists: the user is logged in. */
  | { status: 'signed_in' }
  /** Sign up accepted, but the project requires email confirmation before logging in. */
  | { status: 'confirm_email' }
  | { status: 'error'; message: string }

export async function signInWithEmail({ email, password }: Credentials): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { status: 'error', message: authErrorMessage(error) }
    if (!data.session) return { status: 'error', message: GENERIC_ERROR }
    return { status: 'signed_in' }
  } catch (error) {
    return { status: 'error', message: unexpectedErrorMessage(error) }
  }
}

export async function signUpWithEmail({ email, password }: Credentials): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Where the confirmation link lands. Supabase only honors it if this origin is in the
      // project's redirect allow list; otherwise it falls back to the project's Site URL.
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) return { status: 'error', message: authErrorMessage(error) }
    if (data.session) return { status: 'signed_in' }
    // No session: confirmation is required. When confirmation is on, Supabase also answers
    // this way for an email that's already registered (so accounts can't be probed), and the
    // confirmation screen covers both cases.
    return { status: 'confirm_email' }
  } catch (error) {
    return { status: 'error', message: unexpectedErrorMessage(error) }
  }
}

const GENERIC_ERROR = 'Something went wrong on our end. Please try again.'
const NETWORK_ERROR = 'We couldn’t reach Breadcrumb. Check your connection and try again.'

/** Plain-language message for a Supabase Auth error. Exported for tests. */
export function authErrorMessage(error: AuthError): string {
  // supabase-js uses this class for both a failed request (status 0) and 5xx responses.
  if (isAuthRetryableFetchError(error)) return error.status === 0 ? NETWORK_ERROR : GENERIC_ERROR

  if (isAuthWeakPasswordError(error)) {
    const reasons = error.reasons ?? []
    if (reasons.includes('pwned')) {
      return 'That password has shown up in a data breach. Choose a different one.'
    }
    if (reasons.includes('characters')) {
      return 'That password is too simple. Mix in uppercase letters, numbers, or symbols.'
    }
    return 'That password is too short. Choose a longer one.'
  }

  switch (error.code) {
    case 'invalid_credentials':
      return 'That email and password don’t match. Check them and try again.'
    case 'email_not_confirmed':
      return 'Confirm your email first. Open the link we sent to your inbox, then log in.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Log in instead.'
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return 'We can’t use that email address. Try a different one.'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Signing up with email isn’t available right now.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a few minutes, then try again.'
  }

  if (isAuthApiError(error) && error.status === 429) {
    return 'Too many attempts. Wait a few minutes, then try again.'
  }
  return GENERIC_ERROR
}

function unexpectedErrorMessage(error: unknown): string {
  // fetch() rejects with a TypeError when the network is down or the request is blocked.
  return error instanceof TypeError ? NETWORK_ERROR : GENERIC_ERROR
}

/**
 * Where to go after logging in: the `next` query param if it's a path inside this app,
 * otherwise home. Rejects absolute and protocol-relative URLs so the param can't be
 * used to send people to another site, and never sends them back to an auth page.
 */
export function safeRedirectPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  const path = next.split(/[?#]/)[0]
  if (path === '/login' || path === '/signup') return '/'
  return next
}
