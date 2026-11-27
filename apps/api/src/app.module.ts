/**
 * Root NestJS module: wires config, auth (a global deny-by-default guard) and the
 * controllers. Feature modules (trails, profiles, progress, ratings, ...) are
 * added here as migration tasks land.
 */
import { Module, type DynamicModule } from '@nestjs/common'
import { AuthModule } from './auth/auth.module.js'
import { CommunitiesModule } from './communities/communities.module.js'
import { ConfigModule } from './config/config.module.js'
import type { AppConfig } from './config/env.js'
import { ExploreModule } from './explore/explore.module.js'
import { FriendsModule } from './friends/friends.module.js'
import { HealthController } from './health/health.controller.js'
import { MeController } from './me/me.controller.js'
import { ModerationModule } from './moderation/moderation.module.js'
import { MetaController } from './meta/meta.controller.js'
import { PhotosModule } from './photos/photos.module.js'
import { ProfilesModule } from './profiles/profiles.module.js'
import { ProgressModule } from './progress/progress.module.js'
import { RatingsModule } from './ratings/ratings.module.js'
import { TrailsModule } from './trails/trails.module.js'

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), AuthModule, TrailsModule, ProfilesModule, ProgressModule, RatingsModule, ExploreModule, CommunitiesModule, FriendsModule, PhotosModule, ModerationModule],
      controllers: [HealthController, MetaController, MeController],
    }
  }
}
