/**
 * Vitest config for the contracts package.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { include: ['test/**/*.test.ts'], environment: 'node' } })
