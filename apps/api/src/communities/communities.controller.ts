/**
 * GET /v1/communities (sign-in optional) and PUT /v1/me/community (sign-in required:
 * join one community, or none with null).
 */
import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger'
import { CommunityList, MyCommunity } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { CommunitiesService } from './communities.service.js'

type CommunityBody = z.infer<typeof MyCommunity>

@ApiTags('communities')
@ApiBearerAuth()
@Controller('v1')
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Get('communities')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(CommunityList) })
  async list(@CurrentUser() user: AuthUser | null): Promise<CommunityList> {
    return { communities: await this.communities.list(user) }
  }

  @Put('me/community')
  @HttpCode(200)
  @ApiBody({ schema: openApiSchema(MyCommunity) })
  @ApiOkResponse({ schema: openApiSchema(MyCommunity) })
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiUnprocessableEntityResponse({ description: 'No such community' })
  async setMine(@Body(new ZodValidationPipe(MyCommunity)) body: CommunityBody, @CurrentUser() user: AuthUser): Promise<MyCommunity> {
    return { communityId: await this.communities.setMine(body.communityId, user) }
  }
}
