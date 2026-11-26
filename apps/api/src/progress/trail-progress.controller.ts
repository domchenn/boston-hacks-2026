/**
 * The caller's progress on one trail (sign-in required):
 * GET /v1/me/trails/:trailId/progress, POST /v1/me/trails/:trailId/{start,finish,abort},
 * GET /v1/me/trails/:trailId/crumbs, and PUT / DELETE /v1/me/crumbs/:crumbId to tick
 * or untick a crumb. Status changes follow ProgressService's table.
 */
import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { CrumbParams, CrumbState, TickedCrumbs, TrailAction, TrailProgress, TrailProgressParams } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ProgressService } from './progress.service.js'

type TrailParams = z.infer<typeof TrailProgressParams>
type ActionParams = z.infer<typeof ActionParamsSchema>
type CrumbPathParams = z.infer<typeof CrumbParams>
const ActionParamsSchema = TrailProgressParams.extend({ action: TrailAction })

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@Controller('v1/me')
export class TrailProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get('trails/:trailId/progress')
  @ApiOkResponse({ schema: openApiSchema(TrailProgress) })
  status(@Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams, @CurrentUser() user: AuthUser) {
    return this.progress.status(params.trailId, user)
  }

  @Post('trails/:trailId/:action')
  @HttpCode(200)
  @ApiParam({ name: 'action', enum: ['start', 'finish', 'abort'] })
  @ApiOkResponse({ schema: openApiSchema(TrailProgress) })
  act(@Param(new ZodValidationPipe(ActionParamsSchema)) params: ActionParams, @CurrentUser() user: AuthUser) {
    return this.progress.act(params.trailId, params.action, user)
  }

  @Get('trails/:trailId/crumbs')
  @ApiOkResponse({ schema: openApiSchema(TickedCrumbs) })
  async crumbs(@Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams, @CurrentUser() user: AuthUser): Promise<TickedCrumbs> {
    return { crumbIds: await this.progress.tickedCrumbs(params.trailId, user) }
  }

  @Put('crumbs/:crumbId')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(CrumbState) })
  @ApiForbiddenResponse({ description: 'The trail isn’t started (or was aborted)' })
  tick(@Param(new ZodValidationPipe(CrumbParams)) params: CrumbPathParams, @CurrentUser() user: AuthUser) {
    return this.progress.setCrumb(params.crumbId, true, user)
  }

  @Delete('crumbs/:crumbId')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(CrumbState) })
  untick(@Param(new ZodValidationPipe(CrumbParams)) params: CrumbPathParams, @CurrentUser() user: AuthUser) {
    return this.progress.setCrumb(params.crumbId, false, user)
  }
}
