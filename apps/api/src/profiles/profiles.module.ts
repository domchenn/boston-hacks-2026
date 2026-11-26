/**
 * Profiles and the caller's own lists: read endpoints backed by caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { MyListsController } from './my-lists.controller.js'
import { ProfilesController } from './profiles.controller.js'
import { ProfilesService } from './profiles.service.js'

@Module({ imports: [SupabaseModule], controllers: [ProfilesController, MyListsController], providers: [ProfilesService] })
export class ProfilesModule {}
