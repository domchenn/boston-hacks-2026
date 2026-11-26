/**
 * The trails feature: read endpoints backed by caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { TrailsController } from './trails.controller.js'
import { TrailsService } from './trails.service.js'

@Module({ imports: [SupabaseModule], controllers: [TrailsController], providers: [TrailsService] })
export class TrailsModule {}
