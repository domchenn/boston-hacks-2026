/**
 * Vitest config for the API. SWC compiles the tests so NestJS decorator metadata
 * (used for dependency injection) works the same as in the tsc build.
 */
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  // Integration tests need a local Supabase and run separately (vitest.integration.mts).
  test: { include: ['test/**/*.test.ts'], exclude: ['test/integration/**'], environment: 'node' },
})
