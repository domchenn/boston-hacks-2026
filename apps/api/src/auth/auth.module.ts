/**
 * Registers token verification and makes AuthGuard global, so every route requires
 * a signed-in user unless it opts out with @Public() or @OptionalAuth().
 */
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthGuard } from './auth.guard.js'
import { JwtVerifier } from './jwt-verifier.js'

@Module({
  providers: [JwtVerifier, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [JwtVerifier],
})
export class AuthModule {}
