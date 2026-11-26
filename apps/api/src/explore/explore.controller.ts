/**
 * Explore endpoints: GET /v1/trending (sign-in required), GET /v1/neighborhoods
 * (sign-in optional) and the caller's GET /v1/me/finished-trails for badges
 * (sign-in required). Visibility is decided by RLS and trending_trails().
 */
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { FinishedTrailList, NeighborhoodList, TrendingList, TrendingQuery } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ExploreService } from './explore.service.js'

type TrendingParams = z.infer<typeof TrendingQuery>

@ApiTags('explore')
@ApiBearerAuth()
@Controller('v1')
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  @Get('trending')
  @ApiOkResponse({ schema: openApiSchema(TrendingList) })
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  async trending(@Query(new ZodValidationPipe(TrendingQuery)) query: TrendingParams, @CurrentUser() user: AuthUser): Promise<TrendingList> {
    return { trails: await this.explore.trending(query, user) }
  }

  @Get('neighborhoods')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(NeighborhoodList) })
  async neighborhoods(@CurrentUser() user: AuthUser | null): Promise<NeighborhoodList> {
    return { neighborhoods: await this.explore.neighborhoods(user) }
  }

  @Get('me/finished-trails')
  @ApiOkResponse({ schema: openApiSchema(FinishedTrailList) })
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  async finished(@CurrentUser() user: AuthUser): Promise<FinishedTrailList> {
    return { trails: await this.explore.finishedTrails(user) }
  }
}
