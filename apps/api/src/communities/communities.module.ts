/**
 * Communities (M15a): the list and joining one, backed by caller-scoped Supabase
 * queries.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { CommunitiesController } from './communities.controller.js'
import { CommunitiesService } from './communities.service.js'

@Module({ imports: [SupabaseModule], controllers: [CommunitiesController], providers: [CommunitiesService] })
export class CommunitiesModule {}
