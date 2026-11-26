/**
 * ESLint rules for the contracts package. Run with `npm run lint`.
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
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.browser },
      // Resolve TypeScript configs from this package, not the repo root, so editors that
      // run ESLint from the root don't find several candidate tsconfig folders.
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
])
