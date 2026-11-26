/**
 * GET /v1/trails and GET /v1/trails/:id. Sign-in is optional: signed-out callers see
 * what the anon role may see; signed-in callers see what RLS allows them. Input is
 * validated against @breadcrumb/contracts; a hidden or missing trail is a 404.
 */
import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'
import { ApiBadRequestResponse, ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger'
import { TrailDetail, TrailIdParams, TrailList, TrailListQuery } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { TrailsService } from './trails.service.js'

// Plain aliases (not the schema names) so decorator metadata records Object, not the Zod schema.
type ListQuery = z.infer<typeof TrailListQuery>
type IdParams = z.infer<typeof TrailIdParams>

/** OpenAPI schema objects generated from the shared Zod contract. */
const schema = (type: z.ZodType) => z.toJSONSchema(type, { target: 'openapi-3.0', io: 'output' }) as Record<string, unknown>

@ApiTags('trails')
@ApiBearerAuth()
@OptionalAuth()
@Controller('v1/trails')
export class TrailsController {
  constructor(private readonly trails: TrailsService) {}

  @Get()
  @ApiOkResponse({ schema: schema(TrailList) })
  @ApiBadRequestResponse({ description: 'Unknown or invalid filter' })
  @ApiQuery({ name: 'neighborhood', required: false, type: String })
  @ApiQuery({ name: 'lateNight', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'minCost', required: false, type: Number })
  @ApiQuery({ name: 'maxCost', required: false, type: Number })
  @ApiQuery({ name: 'maxMinutes', required: false, type: Number })
  @ApiQuery({ name: 'communityId', required: false, type: String, format: 'uuid' })
  async list(
    @Query(new ZodValidationPipe(TrailListQuery)) query: ListQuery,
    @CurrentUser() user: AuthUser | null,
  ): Promise<TrailList> {
    return { trails: await this.trails.list(query, user) }
  }

  @Get(':id')
  @ApiOkResponse({ schema: schema(TrailDetail) })
  @ApiNotFoundResponse({ description: 'No such trail, or you may not see it' })
  async get(
    @Param(new ZodValidationPipe(TrailIdParams)) params: IdParams,
    @CurrentUser() user: AuthUser | null,
  ): Promise<TrailDetail> {
    const trail = await this.trails.get(params.id, user)
    if (!trail) throw new NotFoundException('Trail not found.')
    return trail
  }
}
