// ESLint for the Expo app: Expo's recommended rules (eslint-config-expo), ignoring
// build output and Expo's generated files. The React version is given explicitly:
// eslint-plugin-react's auto-detection uses an API that ESLint 10 removed. Whether an
// import resolves is left to TypeScript (`npm run typecheck`), as usual for TypeScript
// projects: eslint-plugin-import's TypeScript resolver doesn't load under ESLint 10.
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    settings: { react: { version: '19.3' }, 'import/resolver': { node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] } } },
    rules: { 'import/no-unresolved': 'off', 'import/namespace': 'off', 'import/no-duplicates': 'off' },
  },
  { ignores: ['dist/*', '.expo/*', 'expo-env.d.ts'] },
])
