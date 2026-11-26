/**
 * GET /v1/me: who the access token belongs to, read from the verified token only
 * (no database access). Requires a signed-in user.
 */
import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'

class MeResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiPropertyOptional({ type: String, nullable: true })
  email!: string | null

  @ApiPropertyOptional({ type: String, nullable: true, example: 'aal1' })
  aal!: string | null

  @ApiProperty()
  isAnonymous!: boolean
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('v1/me')
export class MeController {
  @Get()
  @ApiOkResponse({ type: MeResponse })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  get(@CurrentUser() user: AuthUser): MeResponse {
    return { id: user.id, email: user.email, aal: user.aal, isAnonymous: user.isAnonymous }
  }
}
