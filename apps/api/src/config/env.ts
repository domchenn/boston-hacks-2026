/**
 * API configuration: reads process.env once, validates it with Zod and fails fast
 * with a readable message. SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required;
 * locally they come from apps/api/.env (see .env.example). Every other file gets settings through the APP_CONFIG
 * token instead of reading process.env directly.
 */
import { z } from 'zod'

export const APP_CONFIG = Symbol('APP_CONFIG')

const originList = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
  .pipe(
    z
      .array(
        z.string().refine(isBareOrigin, {
          message: 'each origin must look like https://example.com (http or https, no path or trailing slash)',
        }),
      )
      .min(1, 'must list at least one origin'),
  )

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Which deployment this is; shown by GET /v1/meta. */
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Comma-separated browser origins allowed to call the API. */
  CORS_ORIGINS: originList.default(['http://localhost:5173']),
  /** The Supabase project whose login tokens the API accepts, e.g. https://<ref>.supabase.co */
  SUPABASE_URL: z.string().refine(isBareOrigin, {
    message: 'must be the project URL, such as https://<ref>.supabase.co (no path or trailing slash)',
  }),
  /** The project's publishable (or legacy anon) key. Public; data access runs as the caller under RLS. */
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20, 'must be the project publishable key (sb_publishable_…)'),
})

function isBareOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value
  } catch {
    return false
  }
}

export type AppConfig = z.infer<typeof envSchema>

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    throw new ConfigError(`Invalid API configuration:\n${problems.join('\n')}`)
  }
  return result.data
}
