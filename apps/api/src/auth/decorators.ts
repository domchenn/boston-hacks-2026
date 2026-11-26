/**
 * Route markers for the auth guard and the @CurrentUser() parameter decorator.
 * Every route needs a signed-in user unless marked @Public() or @OptionalAuth().
 */
import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { AuthUser } from './auth-user.js'

export const AUTH_MODE = 'auth:mode'
export type AuthMode = 'public' | 'optional'

/** Anyone may call this route; no token is read. */
export const Public = () => SetMetadata(AUTH_MODE, 'public' satisfies AuthMode)

/** A token is optional, but if one is sent it must be valid. */
export const OptionalAuth = () => SetMetadata(AUTH_MODE, 'optional' satisfies AuthMode)

export type RequestWithUser = FastifyRequest & { user?: AuthUser | null }

/** The verified user (null on @OptionalAuth routes when no token was sent). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  return ctx.switchToHttp().getRequest<RequestWithUser>().user ?? null
})
