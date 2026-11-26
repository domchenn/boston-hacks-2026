/**
 * API entry point: validates config, builds the app and listens on HOST:PORT.
 * Exits with a clear message if the configuration is invalid.
 */
import { ConfigError, loadConfig } from './config/env.js'
import { createApp } from './create-app.js'

async function main(): Promise<void> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }
  const app = await createApp(config)
  app.enableShutdownHooks()
  await app.listen({ host: config.HOST, port: config.PORT })
}

void main()
