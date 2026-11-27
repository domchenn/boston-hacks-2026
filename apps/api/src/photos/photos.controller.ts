/**
 * Trail photos (M16a): GET /v1/trails/:trailId/photos (sign-in optional),
 * POST /v1/trails/:trailId/photos (sign-in required; the request body is the image
 * itself, Content-Type image/*, at most 5 MB; ?caption= and ?stopId= optional) and
 * DELETE /v1/photos/:photoId (your own only). Uploads come back as a clean JPEG.
 */
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UnsupportedMediaTypeException } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger'
import { AddPhotoQuery, PhotoAdded, PhotoDeleted, PhotoParams, TrailPhotoList, TrailProgressParams } from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { UNSUPPORTED } from './image-cleaner.js'
import { PhotosService } from './photos.service.js'

type TrailParams = z.infer<typeof TrailProgressParams>
type AddQuery = z.infer<typeof AddPhotoQuery>
type OnePhoto = z.infer<typeof PhotoParams>
type Photos = z.infer<typeof TrailPhotoList>
type Added = z.infer<typeof PhotoAdded>
type Deleted = z.infer<typeof PhotoDeleted>

@ApiTags('photos')
@ApiBearerAuth()
@Controller('v1')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Get('trails/:trailId/photos')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(TrailPhotoList) })
  async list(@Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams, @CurrentUser() user: AuthUser | null): Promise<Photos> {
    return { photos: await this.photos.list(params.trailId, user) }
  }

  @Post('trails/:trailId/photos')
  @HttpCode(201)
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp')
  @ApiCreatedResponse({ schema: openApiSchema(PhotoAdded) })
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiForbiddenResponse({ description: 'You haven’t saved, started or finished this trail' })
  @ApiPayloadTooLargeResponse({ description: 'Over 5 MB' })
  @ApiUnsupportedMediaTypeResponse({ description: 'Not a JPEG, PNG or WebP image (HEIC included)' })
  async add(
    @Param(new ZodValidationPipe(TrailProgressParams)) params: TrailParams,
    @Query(new ZodValidationPipe(AddPhotoQuery)) query: AddQuery,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
  ): Promise<Added> {
    // Only image/* bodies arrive as a Buffer; JSON, text and the rest are parsed into something else.
    if (!Buffer.isBuffer(body)) throw new UnsupportedMediaTypeException(UNSUPPORTED)
    if (body.length === 0) throw new BadRequestException('Send the photo as the request body.')
    return { photo: await this.photos.add(params.trailId, body, query, user) }
  }

  @Delete('photos/:photoId')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(PhotoDeleted) })
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiNotFoundResponse({ description: 'Not your photo, or it no longer exists' })
  remove(@Param(new ZodValidationPipe(PhotoParams)) params: OnePhoto, @CurrentUser() user: AuthUser): Promise<Deleted> {
    return this.photos.remove(params.photoId, user)
  }
}
