/**
 * Connection details for a local Supabase stack, from environment variables:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY, SUPABASE_TEST_JWT_SECRET,
 *   SUPABASE_TEST_DB_URL
 * (values come from `npx supabase status -o env`). Refuses anything that isn't on
 * localhost, so these tests can never write to a hosted project.
 */
import { SignJWT } from 'jose'

export type LocalSupabase = { url: string; publishableKey: string; jwtSecret: string; dbUrl: string }

export function localSupabase(): LocalSupabase {
  const env = {
    url: process.env.SUPABASE_TEST_URL,
    publishableKey: process.env.SUPABASE_TEST_PUBLISHABLE_KEY,
    jwtSecret: process.env.SUPABASE_TEST_JWT_SECRET,
    dbUrl: process.env.SUPABASE_TEST_DB_URL,
  }
  const missing = Object.entries(env).filter(([, value]) => !value).map(([key]) => key)
  if (missing.length > 0) {
    throw new Error(`Integration tests need a local Supabase. Missing: ${missing.join(', ')} (see test/integration/local-supabase.ts).`)
  }
  for (const value of [env.url!, env.dbUrl!]) {
    const host = new URL(value).hostname
    if (host !== '127.0.0.1' && host !== 'localhost') throw new Error(`Refusing to run integration tests against ${host}.`)
  }
  return env as LocalSupabase
}

/** A user access token the local PostgREST accepts (local Supabase signs with HS256). */
export function userToken(local: LocalSupabase, userId: string): Promise<string> {
  return new SignJWT({ role: 'authenticated', aal: 'aal1', is_anonymous: false })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(local.jwtSecret))
}
