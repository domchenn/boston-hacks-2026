/**
 * Unit tests for AuthGuard's route modes, with a stub verifier: @Public skips
 * auth, @OptionalAuth allows no token but still rejects a bad one, and the default
 * requires a valid token.
 */
import { describe, expect, it } from 'vitest'
import { ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '../src/auth/auth.guard.js'
import type { AuthUser } from '../src/auth/auth-user.js'
import { AUTH_MODE, type RequestWithUser } from '../src/auth/decorators.js'
import { InvalidTokenError, KeysUnavailableError, type JwtVerifier } from '../src/auth/jwt-verifier.js'

const USER = { id: 'u1' } as AuthUser
const log = { debug: () => {}, error: () => {} }

function contextFor(mode: string | undefined, authorization?: string) {
  const handler = () => {}
  if (mode) Reflect.defineMetadata(AUTH_MODE, mode, handler)
  const request = { headers: authorization ? { authorization } : {}, log } as unknown as RequestWithUser
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
  return { context, request }
}

function guardWith(verify: (token: string) => Promise<AuthUser>) {
  return new AuthGuard(new Reflector(), { verify } as unknown as JwtVerifier)
}

const valid = guardWith(async (token) => {
  if (token === 'good') return USER
  throw new InvalidTokenError('bad')
})

describe('AuthGuard', () => {
  it('@Public routes pass without reading the token', async () => {
    const { context, request } = contextFor('public', 'Bearer junk')
    await expect(valid.canActivate(context)).resolves.toBe(true)
    expect(request.user).toBeUndefined()
  })

  it('@OptionalAuth with no token passes with user = null', async () => {
    const { context, request } = contextFor('optional')
    await expect(valid.canActivate(context)).resolves.toBe(true)
    expect(request.user).toBeNull()
  })

  it('@OptionalAuth with a valid token attaches the user', async () => {
    const { context, request } = contextFor('optional', 'Bearer good')
    await expect(valid.canActivate(context)).resolves.toBe(true)
    expect(request.user).toBe(USER)
  })

  it('@OptionalAuth with a bad token is still rejected', async () => {
    const { context } = contextFor('optional', 'Bearer bad')
    await expect(valid.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('default routes require a token', async () => {
    const { context } = contextFor(undefined)
    await expect(valid.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('default routes accept a valid token', async () => {
    const { context, request } = contextFor(undefined, 'Bearer good')
    await expect(valid.canActivate(context)).resolves.toBe(true)
    expect(request.user).toBe(USER)
  })

  it('unreachable keys become 503', async () => {
    const down = guardWith(async () => {
      throw new KeysUnavailableError('down')
    })
    const { context } = contextFor(undefined, 'Bearer good')
    await expect(down.canActivate(context)).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('unexpected verifier errors are not swallowed', async () => {
    const broken = guardWith(async () => {
      throw new Error('boom')
    })
    const { context } = contextFor(undefined, 'Bearer good')
    await expect(broken.canActivate(context)).rejects.toThrow('boom')
  })
})
