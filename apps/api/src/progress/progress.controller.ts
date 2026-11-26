/**
 * Save / unsave for the signed-in caller (sign-in required):
 * PUT and DELETE /v1/me/saved-trails/:trailId, each answering { status } with the
 * caller's resulting status on that trail. A trail they can't see is a 404.
 */
import { Controller, Delete, HttpCode, Param, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { TrailProgress, TrailProgressParams } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ProgressService } from './progress.service.js'

type Params = z.infer<typeof TrailProgressParams>

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@ApiNotFoundResponse({ description: 'The trail is missing or hidden from you' })
@Controller('v1/me/saved-trails')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Put(':trailId')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(TrailProgress) })
  save(@Param(new ZodValidationPipe(TrailProgressParams)) params: Params, @CurrentUser() user: AuthUser): Promise<TrailProgress> {
    return this.progress.save(params.trailId, user)
  }

  @Delete(':trailId')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(TrailProgress) })
  unsave(@Param(new ZodValidationPipe(TrailProgressParams)) params: Params, @CurrentUser() user: AuthUser): Promise<TrailProgress> {
    return this.progress.unsave(params.trailId, user)
  }
}
