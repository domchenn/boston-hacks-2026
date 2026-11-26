/**
 * The signed-in caller's own lists (sign-in required): GET /v1/me/trails?status=
 * (Finished / Saved / Signed up tabs) and GET /v1/me/saved-trails (the Saved page).
 * Progress rows are private to their owner under RLS.
 */
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { MyTrailsQuery, ProfileTrailList, SavedTrailList } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ProfilesService } from './profiles.service.js'

type StatusQuery = z.infer<typeof MyTrailsQuery>

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@Controller('v1/me')
export class MyListsController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('trails')
  @ApiQuery({ name: 'status', enum: ['completed', 'saved', 'signed_up'] })
  @ApiOkResponse({ schema: openApiSchema(ProfileTrailList) })
  async trails(
    @Query(new ZodValidationPipe(MyTrailsQuery)) query: StatusQuery,
    @CurrentUser() user: AuthUser,
  ): Promise<ProfileTrailList> {
    return { trails: await this.profiles.getMyTrails(query.status, user) }
  }

  @Get('saved-trails')
  @ApiOkResponse({ schema: openApiSchema(SavedTrailList) })
  async saved(@CurrentUser() user: AuthUser): Promise<SavedTrailList> {
    return { trails: await this.profiles.getSavedTrails(user) }
  }
}
