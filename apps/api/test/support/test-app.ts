/**
 * Builds a ready-to-inject API app for tests, pointed at a fake Supabase.
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from '../../src/config/env.js'
import { createApp } from '../../src/create-app.js'

export async function startTestApp(env: Record<string, string>): Promise<NestFastifyApplication> {
  const app = await createApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', ...env }))
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}
