/**
 * Global guard: deny by default. Reads "Authorization: Bearer <token>", verifies it
 * and attaches the user to the request. Bad or missing tokens get 401 without
 * details (the reason is logged at debug level); unreachable signing keys get 503
 * rather than letting the request through.
 */
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AUTH_MODE, type AuthMode, type RequestWithUser } from './decorators.js'
import { InvalidTokenError, JwtVerifier, KeysUnavailableError } from './jwt-verifier.js'

const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const mode = this.reflector.getAllAndOverride<AuthMode | undefined>(AUTH_MODE, [
      context.getHandler(),
      context.getClass(),
    ])
    if (mode === 'public') return true

    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const header = request.headers.authorization

    if (header === undefined) {
      if (mode === 'optional') {
        request.user = null
        return true
      }
      throw new UnauthorizedException('Sign in required.')
    }

    const match = BEARER.exec(header)
    if (!match) throw new UnauthorizedException('Use an Authorization: Bearer <access token> header.')

    try {
      request.user = await this.verifier.verify(match[1])
      return true
    } catch (error) {
      if (error instanceof KeysUnavailableError) {
        request.log.error({ err: error.cause }, 'auth signing keys unavailable')
        throw new ServiceUnavailableException('Sign-in checks are temporarily unavailable.')
      }
      if (error instanceof InvalidTokenError) {
        request.log.debug({ reason: error.message }, 'rejected access token')
        throw new UnauthorizedException('Invalid or expired access token.')
      }
      throw error
    }
  }
}
