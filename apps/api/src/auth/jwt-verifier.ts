/**
 * Verifies Supabase access tokens with the project's public signing keys (JWKS):
 * signature (ES256/RS256 only), issuer, audience, expiry and the authenticated role.
 * The key set is fetched from SUPABASE_URL and cached by jose. Failures are
 * classified so the guard can answer 401 (bad token) or 503 (keys unreachable).
 */
import { Inject, Injectable } from '@nestjs/common'
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from 'jose'
import { APP_CONFIG, type AppConfig } from '../config/env.js'
import type { AuthUser } from './auth-user.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TOKEN_LENGTH = 8192

export class InvalidTokenError extends Error {}
export class KeysUnavailableError extends Error {}

@Injectable()
export class JwtVerifier {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>
  private readonly issuer: string

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.issuer = `${config.SUPABASE_URL}/auth/v1`
    this.keys = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    })
  }

  async verify(token: string): Promise<AuthUser> {
    if (token.length > MAX_TOKEN_LENGTH) throw new InvalidTokenError('token too long')

    let payload: JWTPayload
    try {
      ;({ payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
        clockTolerance: 30,
        requiredClaims: ['sub', 'exp', 'iat'],
      }))
    } catch (error) {
      if (isKeyFetchFailure(error)) throw new KeysUnavailableError('could not fetch signing keys', { cause: error })
      throw new InvalidTokenError(error instanceof Error ? error.message : 'invalid token', { cause: error })
    }

    if (payload.role !== 'authenticated') throw new InvalidTokenError(`role ${String(payload.role)} is not a signed-in user`)
    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) throw new InvalidTokenError('sub is not a user id')

    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      role: 'authenticated',
      aal: typeof payload.aal === 'string' ? payload.aal : null,
      sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
      isAnonymous: payload.is_anonymous === true,
      accessToken: token,
    }
  }
}

/** Network errors, timeouts and unusable key documents mean "can't check", not "bad token". */
function isKeyFetchFailure(error: unknown): boolean {
  if (error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid) return true
  // jose reports a non-200 key-set response as a plain JOSEError (not a subclass).
  if (error instanceof errors.JOSEError) return error.constructor === errors.JOSEError && /JSON Web Key Set/.test(error.message)
  return error instanceof TypeError || (error instanceof Error && /fetch|network|ECONN|status code/i.test(error.message))
}
