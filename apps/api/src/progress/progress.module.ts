/**
 * Progress writes (M12b: save / unsave) backed by caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { ProgressController } from './progress.controller.js'
import { ProgressService } from './progress.service.js'

@Module({ imports: [SupabaseModule], controllers: [ProgressController], providers: [ProgressService] })
export class ProgressModule {}
