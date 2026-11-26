/**
 * ESLint rules for the API (TypeScript on Node). Run with `npm run lint`.
 */

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      // Resolve TypeScript configs from apps/api, not the repo root, so editors that
      // run ESLint from the root don't find several candidate tsconfig folders.
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
])
