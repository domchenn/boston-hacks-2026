/**
 * Explore reads (M15a): Trending, the neighborhood list and your finished trails for
 * badges, backed by caller-scoped Supabase queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { ExploreController } from './explore.controller.js'
import { ExploreService } from './explore.service.js'

@Module({ imports: [SupabaseModule], controllers: [ExploreController], providers: [ExploreService] })
export class ExploreModule {}
