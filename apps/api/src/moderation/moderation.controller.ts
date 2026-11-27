/**
 * Reports and moderation (M16b), all sign-in required: POST /v1/reports (anyone),
 * GET /v1/me/admin (am I a moderator?), and for moderators only (403 otherwise)
 * GET /v1/admin/reports, POST /v1/admin/reports/:reportId/resolve and
 * POST /v1/admin/photos/move-older (move older public photos into private storage).
 */
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { AdminStatus, OlderPhotosMoved, OpenReportList, ReportBody, ReportParams, ReportResolved, ReportSent, ResolveReportBody } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { ModerationService } from './moderation.service.js'

type NewReport = z.infer<typeof ReportBody>
type Sent = z.infer<typeof ReportSent>
type Status = z.infer<typeof AdminStatus>
type Reports = z.infer<typeof OpenReportList>
type OneReport = z.infer<typeof ReportParams>
type Resolution = z.infer<typeof ResolveReportBody>
type Resolved = z.infer<typeof ReportResolved>
type Moved = z.infer<typeof OlderPhotosMoved>

@ApiTags('moderation')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sign in required' })
@Controller('v1')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  @HttpCode(201)
  @ApiBody({ schema: openApiSchema(ReportBody) })
  @ApiCreatedResponse({ schema: openApiSchema(ReportSent) })
  report(@Body(new ZodValidationPipe(ReportBody)) body: NewReport, @CurrentUser() user: AuthUser): Promise<Sent> {
    return this.moderation.report(body, user)
  }

  @Get('me/admin')
  @ApiOkResponse({ schema: openApiSchema(AdminStatus) })
  async admin(@CurrentUser() user: AuthUser): Promise<Status> {
    return { isAdmin: await this.moderation.isAdmin(user) }
  }

  @Get('admin/reports')
  @ApiOkResponse({ schema: openApiSchema(OpenReportList) })
  @ApiForbiddenResponse({ description: 'Moderators only' })
  async reports(@CurrentUser() user: AuthUser): Promise<Reports> {
    return { reports: await this.moderation.openReports(user) }
  }

  @Post('admin/reports/:reportId/resolve')
  @HttpCode(200)
  @ApiBody({ schema: openApiSchema(ResolveReportBody) })
  @ApiOkResponse({ schema: openApiSchema(ReportResolved) })
  @ApiForbiddenResponse({ description: 'Moderators only' })
  @ApiNotFoundResponse({ description: 'No such report' })
  @ApiConflictResponse({ description: 'Already handled' })
  resolve(
    @Param(new ZodValidationPipe(ReportParams)) params: OneReport,
    @Body(new ZodValidationPipe(ResolveReportBody)) body: Resolution,
    @CurrentUser() user: AuthUser,
  ): Promise<Resolved> {
    return this.moderation.resolve(params.reportId, body.action, user)
  }

  @Post('admin/photos/move-older')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(OlderPhotosMoved) })
  @ApiForbiddenResponse({ description: 'Moderators only' })
  moveOlderPhotos(@CurrentUser() user: AuthUser): Promise<Moved> {
    return this.moderation.moveOlderPhotos(user)
  }
}
