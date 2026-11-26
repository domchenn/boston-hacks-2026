/**
 * The trails feature: reads (GET) and writes (POST/PUT through save_trail()), all as the caller.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { TrailWritesController } from './trail-writes.controller.js'
import { TrailWritesService } from './trail-writes.service.js'
import { TrailsController } from './trails.controller.js'
import { TrailsService } from './trails.service.js'

@Module({
  imports: [SupabaseModule],
  controllers: [TrailsController, TrailWritesController],
  providers: [TrailsService, TrailWritesService],
})
export class TrailsModule {}
