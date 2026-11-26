/**
 * Root NestJS module: wires config, auth (a global deny-by-default guard) and the
 * controllers. Feature modules (trails,
 * profiles, ...) are added here in later migration tasks.
 */
import { Module, type DynamicModule } from '@nestjs/common'
import { AuthModule } from './auth/auth.module.js'
import { ConfigModule } from './config/config.module.js'
import type { AppConfig } from './config/env.js'
import { HealthController } from './health/health.controller.js'
import { MeController } from './me/me.controller.js'
import { MetaController } from './meta/meta.controller.js'
import { TrailsModule } from './trails/trails.module.js'

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), AuthModule, TrailsModule],
      controllers: [HealthController, MetaController, MeController],
    }
  }
}
