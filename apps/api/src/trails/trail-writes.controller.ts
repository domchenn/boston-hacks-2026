/**
 * POST /v1/trails (create) and PUT /v1/trails/:id (replace), sign-in required.
 * The body is the save_trail() payload from @breadcrumb/contracts (SaveTrailBody);
 * rule violations come back as 422/403 with save_trail()'s own message.
 */
import { Body, Controller, HttpCode, Param, Post, Put } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { SaveTrailBody, TrailIdParams, TrailSaved } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { TrailWritesService } from './trail-writes.service.js'

type SaveBody = z.infer<typeof SaveTrailBody>
type IdParams = z.infer<typeof TrailIdParams>

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
}
