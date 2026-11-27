/**
 * GET and PUT /v1/me/profile (sign-in required): the caller's username, display name
 * and university, as on the onboarding page. A taken username is 409.
 */
import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger'
import { MyProfileBody, MyProfileFields } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { MyProfileService } from './my-profile.service.js'

type ProfileBody = z.infer<typeof MyProfileBody>
type Fields = z.infer<typeof MyProfileFields>

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@Controller('v1/me/profile')
export class MyProfileController {
  constructor(private readonly profile: MyProfileService) {}

  @Get()
  @ApiOkResponse({ schema: openApiSchema(MyProfileFields) })
  get(@CurrentUser() user: AuthUser): Promise<Fields> {
    return this.profile.get(user)
  }

  @Put()
  @HttpCode(200)
  @ApiBody({ schema: openApiSchema(MyProfileBody) })
  @ApiOkResponse({ schema: openApiSchema(MyProfileFields) })
  @ApiConflictResponse({ description: 'That username is taken' })
  @ApiUnprocessableEntityResponse({ description: 'A value the database refuses' })
  update(@Body(new ZodValidationPipe(MyProfileBody)) body: ProfileBody, @CurrentUser() user: AuthUser): Promise<Fields> {
    return this.profile.update(body, user)
  }
}
