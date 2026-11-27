/**
 * Friends' activity and finding people (M15c). Sign-in optional:
 * GET /v1/trail-cards?ids=… (cards for trails the caller can see). Sign-in required:
 * GET /v1/me/friends-activity, /v1/me/friends-also-saved, /v1/people?q= and
 * /v1/me/suggested-people.
 */
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import {
  ActivityQuery,
  AlsoSavedList,
  FriendsActivity,
  PeopleSearchQuery,
  PersonList,
  SuggestionsQuery,
  TrailCardList,
  TrailCardsQuery,
} from '@breadcrumb/contracts'
import { z } from 'zod'
import type { AuthUser } from '../auth/auth-user.js'
import { CurrentUser, OptionalAuth } from '../auth/decorators.js'
import { openApiSchema } from '../common/openapi-schema.js'
import { ZodValidationPipe } from '../common/zod-validation.pipe.js'
import { PeopleService } from './people.service.js'

type CardsParams = z.infer<typeof TrailCardsQuery>
type ActivityParams = z.infer<typeof ActivityQuery>
type SearchParams = z.infer<typeof PeopleSearchQuery>
type SuggestParams = z.infer<typeof SuggestionsQuery>
type Cards = z.infer<typeof TrailCardList>
type Activity = z.infer<typeof FriendsActivity>
type Saves = z.infer<typeof AlsoSavedList>
type People = z.infer<typeof PersonList>

/** The web's defaults. */
const ACTIVITY_LIMIT = 30
const SEARCH_LIMIT = 8
const SUGGESTION_LIMIT = 6

@ApiTags('friends')
@ApiBearerAuth()
@Controller('v1')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('trail-cards')
  @OptionalAuth()
  @ApiOkResponse({ schema: openApiSchema(TrailCardList) })
  async cards(@Query(new ZodValidationPipe(TrailCardsQuery)) query: CardsParams, @CurrentUser() user: AuthUser | null): Promise<Cards> {
    return { trails: await this.people.cards(query.ids, user) }
  }

  @Get('me/friends-activity')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(FriendsActivity) })
  activity(@Query(new ZodValidationPipe(ActivityQuery)) query: ActivityParams, @CurrentUser() user: AuthUser): Promise<Activity> {
    return this.people.activity(query.limit ?? ACTIVITY_LIMIT, user)
  }

  @Get('me/friends-also-saved')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(AlsoSavedList) })
  async alsoSaved(@CurrentUser() user: AuthUser): Promise<Saves> {
    return { saves: await this.people.alsoSaved(user) }
  }

  @Get('people')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(PersonList) })
  async search(@Query(new ZodValidationPipe(PeopleSearchQuery)) query: SearchParams, @CurrentUser() user: AuthUser): Promise<People> {
    return { people: await this.people.search(query.q, query.limit ?? SEARCH_LIMIT, user) }
  }

  @Get('me/suggested-people')
  @ApiUnauthorizedResponse({ description: 'Sign in required' })
  @ApiOkResponse({ schema: openApiSchema(PersonList) })
  async suggested(@Query(new ZodValidationPipe(SuggestionsQuery)) query: SuggestParams, @CurrentUser() user: AuthUser): Promise<People> {
    return { people: await this.people.suggestions(query.limit ?? SUGGESTION_LIMIT, user) }
  }
}
