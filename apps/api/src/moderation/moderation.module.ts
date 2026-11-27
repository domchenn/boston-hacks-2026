/**
 * Reports and moderation (M16b), backed by caller-scoped Supabase queries and Storage.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { ModerationController } from './moderation.controller.js'
import { ModerationService } from './moderation.service.js'

@Module({ imports: [SupabaseModule], controllers: [ModerationController], providers: [ModerationService] })
export class ModerationModule {}
