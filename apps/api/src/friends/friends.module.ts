/**
 * Follows, friends, close friends and private accounts (M15b), backed by
 * caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { FriendsController } from './friends.controller.js'
import { FriendsService } from './friends.service.js'

@Module({ imports: [SupabaseModule], controllers: [FriendsController], providers: [FriendsService] })
export class FriendsModule {}
