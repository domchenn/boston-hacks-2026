/**
 * Profile endpoints (sign-in optional): GET /v1/profiles/:handle (id or username),
 * /v1/profiles/:id/stats and /v1/profiles/:id/made-trails. What the caller sees is
 * decided by RLS; unknown profiles are 404.
 */
import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { ProfileHandleParams, ProfileIdParams, ProfileStats, ProfileTrailList, PublicProfile } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ProfilesService } from './profiles.service.js'

type HandleParams = z.infer<typeof ProfileHandleParams>
type IdParams = z.infer<typeof ProfileIdParams>

@ApiTags('profiles')
@ApiBearerAuth()
@OptionalAuth()
@Controller('v1/profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':handle')
  @ApiOkResponse({ schema: openApiSchema(PublicProfile) })
  @ApiNotFoundResponse({ description: 'No such profile' })
  async get(
    @Param(new ZodValidationPipe(ProfileHandleParams)) params: HandleParams,
    @CurrentUser() user: AuthUser | null,
  ): Promise<PublicProfile> {
    const profile = await this.profiles.getProfile(params.handle, user)
    if (!profile) throw new NotFoundException('Profile not found.')
    return profile
  }

  @Get(':id/stats')
  @ApiOkResponse({ schema: openApiSchema(ProfileStats) })
  stats(@Param(new ZodValidationPipe(ProfileIdParams)) params: IdParams, @CurrentUser() user: AuthUser | null) {
    return this.profiles.getStats(params.id, user)
  }

  @Get(':id/made-trails')
  @ApiOkResponse({ schema: openApiSchema(ProfileTrailList) })
  async made(
    @Param(new ZodValidationPipe(ProfileIdParams)) params: IdParams,
    @CurrentUser() user: AuthUser | null,
  ): Promise<ProfileTrailList> {
    return { trails: await this.profiles.getMadeTrails(params.id, user) }
  }
}
