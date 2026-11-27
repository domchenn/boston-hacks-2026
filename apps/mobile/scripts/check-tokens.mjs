// Fails if a colour in src/theme/tokens.ts differs from docs/styles/tokens.css, the
// style guide's source of truth. Run by `npm run lint` (Node strips the TypeScript types).
import { readFileSync } from 'node:fs'
import { colors, cssNames } from '../src/theme/tokens.ts'

const css = readFileSync(new URL('../../../docs/styles/tokens.css', import.meta.url), 'utf8')
const problems = []
for (const [key, value] of Object.entries(colors)) {
  const name = cssNames[key]
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!match) problems.push(`${name} not found in tokens.css`)
  else if (match[1].toUpperCase() !== value.toUpperCase()) problems.push(`${key}: ${value} here, ${match[1]} in tokens.css`)
}
if (problems.length > 0) {
  console.error(`Mobile tokens drifted from docs/styles/tokens.css:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log(`Mobile tokens match docs/styles/tokens.css (${Object.keys(colors).length} colours).`)
