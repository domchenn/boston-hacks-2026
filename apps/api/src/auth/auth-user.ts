/**
 * The signed-in user as the API sees them, built only from a verified Supabase
 * access token. Controllers receive it through @CurrentUser().
 */
export type AuthUser = {
  /** auth.users id (the token's sub claim). */
  id: string
  email: string | null
  role: 'authenticated'
  /** Authenticator assurance level: aal1 (password/OAuth) or aal2 (with MFA). */
  aal: string | null
  sessionId: string | null
  isAnonymous: boolean
  /** The raw token, kept so later data access can run as this user under RLS. */
  accessToken: string
}
