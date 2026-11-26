/**
 * Root NestJS module: wires config and the controllers. Feature modules (trails,
 * profiles, ...) are added here in later migration tasks.
 */
import { Module, type DynamicModule } from '@nestjs/common'
import { ConfigModule } from './config/config.module.js'
import type { AppConfig } from './config/env.js'
import { HealthController } from './health/health.controller.js'
import { MetaController } from './meta/meta.controller.js'

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return { module: AppModule, imports: [ConfigModule.forRoot(config)], controllers: [HealthController, MetaController] }
  }
}
