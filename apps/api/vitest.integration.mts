/**
 * Vitest config for integration tests that need a running local Supabase (see
 * test/integration/). Run with `npm run test:integration`; not part of `npm test`.
 */
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The files share one database and compare whole-table results with Supabase, so run
    // them one at a time: another file's fixtures appearing mid-comparison would make it flaky.
    fileParallelism: false,
  },
})
