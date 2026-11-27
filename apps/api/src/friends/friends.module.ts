/**
 * Follows, friends, close friends and private accounts (M15b), and friends'
 * activity, "also saved", trail cards and finding people (M15c), backed by
 * caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { FriendsController } from './friends.controller.js'
import { FriendsService } from './friends.service.js'
import { PeopleController } from './people.controller.js'
import { PeopleService } from './people.service.js'

@Module({ imports: [SupabaseModule], controllers: [FriendsController, PeopleController], providers: [FriendsService, PeopleService] })
export class FriendsModule {}
