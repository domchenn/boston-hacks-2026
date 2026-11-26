/**
 * The caller's rating of one trail (sign-in required): GET, PUT (create or edit) and
 * DELETE /v1/me/trails/:trailId/rating, each answering { rating } (null = none).
 * Rule refusals from the database: not finished → 422, your own trail → 403.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { MyRatingResponse, RatingBody, TrailProgressParams } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { RatingsService } from './ratings.service.js'

type TrailParams = z.infer<typeof TrailProgressParams>
type RateBody = z.infer<typeof RatingBody>
type RatingResult = z.infer<typeof MyRatingResponse>

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@Controller('v1/me/trails/:trailId/rating')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get()
  @ApiOkResponse({ schema: openApiSchema(MyRatingResponse) })
  async get(@Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams, @CurrentUser() user: AuthUser): Promise<RatingResult> {
    return { rating: await this.ratings.get(params.trailId, user) }
  }

  @Put()
  @HttpCode(200)
  @ApiBody({ schema: openApiSchema(RatingBody) })
  @ApiOkResponse({ schema: openApiSchema(MyRatingResponse) })
  @ApiUnprocessableEntityResponse({ description: 'You haven’t finished this trail' })
  @ApiForbiddenResponse({ description: 'You made this trail' })
  async rate(
    @Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams,
    @Body(new ZodValidationPipe(RatingBody)) body: RateBody,
    @CurrentUser() user: AuthUser,
  ): Promise<RatingResult> {
    return { rating: await this.ratings.rate(params.trailId, body, user) }
  }

  @Delete()
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(MyRatingResponse) })
  async remove(@Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams, @CurrentUser() user: AuthUser): Promise<RatingResult> {
    await this.ratings.remove(params.trailId, user)
    return { rating: null }
  }
}
