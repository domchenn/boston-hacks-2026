/**
 * The caller's own trail ratings (M14b), backed by caller-scoped Supabase queries;
 * the rating rules stay in the database trigger validate_rating.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { RatingsController } from './ratings.controller.js'
import { RatingsService } from './ratings.service.js'

@Module({ imports: [SupabaseModule], controllers: [RatingsController], providers: [RatingsService] })
export class RatingsModule {}
