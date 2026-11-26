/**
 * Test stand-in for Supabase Auth's public key endpoint. Serves a JWKS on a random
 * local port and signs access tokens the way Supabase does (ES256, iss
 * <url>/auth/v1, aud authenticated), with overrides for building bad tokens.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK, type JWTPayload } from 'jose'

export const USER_ID = '11111111-2222-4333-8444-555555555555'

export type FakeSupabase = {
  url: string
  /** Signs a token; `claims` overrides or removes (undefined) default claims. */
  token: (claims?: Record<string, unknown>, options?: { key?: CryptoKey; kid?: string; alg?: string }) => Promise<string>
  /** A second key pair the server does not publish. */
  otherKey: CryptoKey
  /** Make the key endpoint fail (HTTP 500) until set back to false. */
  setBroken: (broken: boolean) => void
  close: () => Promise<void>
}

export async function startFakeSupabase(): Promise<FakeSupabase> {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const other = await generateKeyPair('ES256')
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' }
  let broken = false

  const server: Server = createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json' && !broken) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }))
    } else {
      res.writeHead(broken ? 500 : 404).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    url,
    otherKey: other.privateKey,
    setBroken: (value) => {
      broken = value
    },
    async token(claims = {}, options = {}) {
      const now = Math.floor(Date.now() / 1000)
      const base: Record<string, unknown> = {
        iss: `${url}/auth/v1`,
        aud: 'authenticated',
        sub: USER_ID,
        role: 'authenticated',
        email: 'test1@example.com',
        aal: 'aal1',
        session_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        is_anonymous: false,
        iat: now,
        exp: now + 3600,
      }
      const payload = Object.fromEntries(
        Object.entries({ ...base, ...claims }).filter(([, value]) => value !== undefined),
      ) as JWTPayload
      return new SignJWT(payload)
        .setProtectedHeader({ alg: options.alg ?? 'ES256', kid: options.kid ?? 'test-key', typ: 'JWT' })
        .sign(options.key ?? privateKey)
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
