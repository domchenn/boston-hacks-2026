/**
 * DELETE /v1/me (sign-in required): deletes the caller's account and everything linked
 * to it. The body must be { "confirm": true }.
 */
import { Body, Controller, Delete, HttpCode } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { AccountDeleted, DeleteAccountBody } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { AccountService } from './account.service.js'

type Confirm = z.infer<typeof DeleteAccountBody>
type Deleted = z.infer<typeof AccountDeleted>

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@Controller('v1/me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Delete()
  @HttpCode(200)
  @ApiBody({ schema: openApiSchema(DeleteAccountBody) })
  @ApiOkResponse({ schema: openApiSchema(AccountDeleted) })
  @ApiServiceUnavailableResponse({ description: 'Some photo files couldn’t be removed; nothing else was deleted' })
  // The body is checked even though it's only { confirm: true }: a stray DELETE can't delete an account.
  async remove(@Body(new ZodValidationPipe(DeleteAccountBody)) _body: Confirm, @CurrentUser() user: AuthUser): Promise<Deleted> {
    return this.account.deleteAccount(user)
  }
}
