/**
 * Follows and friends (M15b). Sign-in optional: GET /v1/profiles/:id/follow-counts,
 * /followers and /following (follows are public). Sign-in required, all about the
 * caller: GET /v1/me/following-ids, PUT / DELETE /v1/me/following/:userId,
 * GET /v1/me/relationships/:userId, GET /v1/me/friends, GET /v1/me/close-friends,
 * PUT / DELETE /v1/me/close-friends/:userId and PUT /v1/me/privacy.
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
import {
  CloseFriendState,
  FollowCounts,
  FollowState,
  PersonIdList,
  PersonList,
  PersonParams,
  Privacy,
  ProfileIdParams,
  Relationship,
} from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { FriendsService } from './friends.service.js'

type IdParams = z.infer<typeof ProfileIdParams>
type OtherParams = z.infer<typeof PersonParams>
type PrivacyBody = z.infer<typeof Privacy>
type Counts = z.infer<typeof FollowCounts>
type People = z.infer<typeof PersonList>
type Ids = z.infer<typeof PersonIdList>
type Follow = z.infer<typeof FollowState>
type Connection = z.infer<typeof Relationship>
type Close = z.infer<typeof CloseFriendState>

const idPipe = new ZodValidationPipe(ProfileIdParams)
const personPipe = new ZodValidationPipe(PersonParams)

@ApiTags('friends')
@ApiBearerAuth()
@Controller('v1')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  // ------------------------------------------------------------ anyone's follows

  @Get('profiles/:id/follow-counts')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(FollowCounts) })
  counts(@Param(idPipe) params: IdParams, @CurrentUser() user: AuthUser | null): Promise<Counts> {
    return this.friends.followCounts(params.id, user)
  }

  @Get('profiles/:id/followers')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(PersonList) })
  async followers(@Param(idPipe) params: IdParams, @CurrentUser() user: AuthUser | null): Promise<People> {
    return { people: await this.friends.followList(params.id, 'followers', user) }
  }

  @Get('profiles/:id/following')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(PersonList) })
  async following(@Param(idPipe) params: IdParams, @CurrentUser() user: AuthUser | null): Promise<People> {
    return { people: await this.friends.followList(params.id, 'following', user) }
  }

  // ------------------------------------------------------------ the caller's own

  @Get('me/following-ids')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(PersonIdList) })
  async followingIds(@CurrentUser() user: AuthUser): Promise<Ids> {
    return { ids: await this.friends.followingIds(user) }
  }

  @Put('me/following/:userId')
  @HttpCode(200)
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiUnprocessableEntityResponse({ description: 'Following yourself' })
  @ApiOkResponse({ schema: openApiSchema(FollowState) })
  async follow(@Param(personPipe) params: OtherParams, @CurrentUser() user: AuthUser): Promise<Follow> {
    return { following: await this.friends.setFollowing(params.userId, true, user) }
  }

  @Delete('me/following/:userId')
  @HttpCode(200)
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(FollowState) })
  async unfollow(@Param(personPipe) params: OtherParams, @CurrentUser() user: AuthUser): Promise<Follow> {
    return { following: await this.friends.setFollowing(params.userId, false, user) }
  }

  @Get('me/relationships/:userId')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(Relationship) })
  relationship(@Param(personPipe) params: OtherParams, @CurrentUser() user: AuthUser): Promise<Connection> {
    return this.friends.relationship(params.userId, user)
  }

  @Get('me/friends')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(PersonList) })
  async myFriends(@CurrentUser() user: AuthUser): Promise<People> {
    return { people: await this.friends.friends(user) }
  }

  @Get('me/close-friends')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(PersonIdList) })
  async closeFriends(@CurrentUser() user: AuthUser): Promise<Ids> {
    return { ids: await this.friends.closeFriendIds(user) }
  }

  @Put('me/close-friends/:userId')
  @HttpCode(200)
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiForbiddenResponse({ description: 'Not a friend (mutual follow)' })
  @ApiOkResponse({ schema: openApiSchema(CloseFriendState) })
  async addCloseFriend(@Param(personPipe) params: OtherParams, @CurrentUser() user: AuthUser): Promise<Close> {
    return { closeFriend: await this.friends.setCloseFriend(params.userId, true, user) }
  }

  @Delete('me/close-friends/:userId')
  @HttpCode(200)
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(CloseFriendState) })
  async removeCloseFriend(@Param(personPipe) params: OtherParams, @CurrentUser() user: AuthUser): Promise<Close> {
    return { closeFriend: await this.friends.setCloseFriend(params.userId, false, user) }
  }

  @Put('me/privacy')
  @HttpCode(200)
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiBody({ schema: openApiSchema(Privacy) })
  @ApiOkResponse({ schema: openApiSchema(Privacy) })
  async privacy(@Body(new ZodValidationPipe(Privacy)) body: PrivacyBody, @CurrentUser() user: AuthUser): Promise<PrivacyBody> {
    return { isPrivate: await this.friends.setPrivate(body.isPrivate, user) }
  }
}
