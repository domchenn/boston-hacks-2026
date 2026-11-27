/**
 * POST /v1/trails (create) and PUT /v1/trails/:id (replace), sign-in required.
 * The body is the save_trail() payload from @breadcrumb/contracts (SaveTrailBody);
 * rule violations come back as 422/403 with save_trail()'s own message. Also
 * GET /v1/trails/:id/stop-library (sign-in optional), POST /v1/trails/:id/unpublish
 * and DELETE /v1/trails/:id (sign-in required; 404 unless it's your trail).
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { SaveTrailBody, StopLibrary, TrailDeleted, TrailIdParams, TrailSaved, TrailUnpublished } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { TrailWritesService } from './trail-writes.service.js'

type SaveBody = z.infer<typeof SaveTrailBody>
type IdParams = z.infer<typeof TrailIdParams>
type Library = z.infer<typeof StopLibrary>
type Unpublished = z.infer<typeof TrailUnpublished>
type Deleted = z.infer<typeof TrailDeleted>

@ApiTags('trails')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@ApiUnprocessableEntityResponse({ description: 'A save_trail() rule, e.g. "Add at least 2 stops before publishing"' })
@ApiForbiddenResponse({ description: 'Not your trail, not your community, or a remix of a trail you can’t see' })
@Controller('v1/trails')
export class TrailWritesController {
  constructor(private readonly writes: TrailWritesService) {}

  @Post()
  @HttpCode(201)
  @ApiBody({ schema: openApiSchema(SaveTrailBody) })
  @ApiCreatedResponse({ schema: openApiSchema(TrailSaved) })
  create(@Body(new ZodValidationPipe(SaveTrailBody)) body: SaveBody, @CurrentUser() user: AuthUser): Promise<TrailSaved> {
    return this.writes.save(body, null, user)
  }

  @Put(':id')
  @HttpCode(200)
  @ApiBody({ schema: openApiSchema(SaveTrailBody) })
  @ApiOkResponse({ schema: openApiSchema(TrailSaved) })
  replace(
    @Param(new ZodValidationPipe(TrailIdParams)) params: IdParams,
    @Body(new ZodValidationPipe(SaveTrailBody)) body: SaveBody,
    @CurrentUser() user: AuthUser,
  ): Promise<TrailSaved> {
    return this.writes.save(body, params.id, user)
  }

  @Get(':id/stop-library')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(StopLibrary) })
  async stopLibrary(@Param(new ZodValidationPipe(TrailIdParams)) params: IdParams, @CurrentUser() user: AuthUser | null): Promise<Library> {
    return { stops: await this.writes.stopLibrary(params.id, user) }
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(TrailUnpublished) })
  @ApiNotFoundResponse({ description: 'Not your trail, or it no longer exists' })
  unpublish(@Param(new ZodValidationPipe(TrailIdParams)) params: IdParams, @CurrentUser() user: AuthUser): Promise<Unpublished> {
    return this.writes.unpublish(params.id, user)
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(TrailDeleted) })
  @ApiNotFoundResponse({ description: 'Not your trail, or it no longer exists' })
  remove(@Param(new ZodValidationPipe(TrailIdParams)) params: IdParams, @CurrentUser() user: AuthUser): Promise<Deleted> {
    return this.writes.remove(params.id, user)
  }
}
