/**
 * Postgres numeric columns can arrive as strings from PostgREST; normalise to number | null.
 * Shared by the API's data mappers.
 */
export type Numeric = number | string | null | undefined

export function num(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}
