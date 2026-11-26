/**
 * Vitest config for the API. SWC compiles the tests so NestJS decorator metadata
 * (used for dependency injection) works the same as in the tsc build.
 */
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
})
