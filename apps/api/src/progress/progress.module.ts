/**
 * The caller's progress on trails: save / unsave (M12b), status, start / finish / abort
 * and crumb ticks (M14a), backed by caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { ProgressController } from './progress.controller.js'
import { ProgressService } from './progress.service.js'
import { TrailProgressController } from './trail-progress.controller.js'

@Module({ imports: [SupabaseModule], controllers: [ProgressController, TrailProgressController], providers: [ProgressService] })
export class ProgressModule {}
