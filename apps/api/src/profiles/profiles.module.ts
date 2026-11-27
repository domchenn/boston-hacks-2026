/**
 * Profiles, the caller's own lists and editable profile fields, backed by caller-scoped
 * Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { MyListsController } from './my-lists.controller.js'
import { MyProfileController } from './my-profile.controller.js'
import { MyProfileService } from './my-profile.service.js'
import { ProfilesController } from './profiles.controller.js'
import { ProfilesService } from './profiles.service.js'

@Module({ imports: [SupabaseModule], controllers: [ProfilesController, MyListsController, MyProfileController], providers: [ProfilesService, MyProfileService] })
export class ProfilesModule {}
