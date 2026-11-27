/**
 * Trail photos (M16a): reading, adding (cleaned to a metadata-free JPEG) and deleting,
 * backed by caller-scoped Supabase queries and Storage.
 */
import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module.js'
import { PhotosController } from './photos.controller.js'
import { PhotosService } from './photos.service.js'

@Module({ imports: [SupabaseModule], controllers: [PhotosController], providers: [PhotosService] })
export class PhotosModule {}
