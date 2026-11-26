/**
 * Tests for loadConfig(): defaults, parsing, the required SUPABASE_URL and the
 * readable error for bad values.
 */
import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../src/config/env.js'

const SUPABASE = {
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_000000',
}

describe('loadConfig', () => {
  it('uses safe local defaults', () => {
    const config = loadConfig({ ...SUPABASE })
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      PORT: 3001,
      CORS_ORIGINS: ['http://localhost:5173'],
    })
  })

  it('parses a comma-separated origin list and a numeric port', () => {
    const config = loadConfig({
      ...SUPABASE,
      PORT: '8080',
      CORS_ORIGINS: 'https://breadcrumb.boston, https://breadcrumb-staging-seven.vercel.app',
    })
    expect(config.PORT).toBe(8080)
    expect(config.CORS_ORIGINS).toEqual(['https://breadcrumb.boston', 'https://breadcrumb-staging-seven.vercel.app'])
  })

  it('rejects bad values with one readable message listing every problem', () => {
    const attempt = () =>
      loadConfig({ ...SUPABASE, PORT: 'abc', APP_ENV: 'prod', CORS_ORIGINS: 'https://x.com/,nope' })
    expect(attempt).toThrow(ConfigError)
    expect(attempt).toThrow(/PORT/)
    expect(attempt).toThrow(/APP_ENV/)
    expect(attempt).toThrow(/CORS_ORIGINS\.0/)
    expect(attempt).toThrow(/CORS_ORIGINS\.1/)
  })

  it('rejects an empty origin list', () => {
    expect(() => loadConfig({ ...SUPABASE, CORS_ORIGINS: ' , ' })).toThrow(/at least one origin/)
  })

  it('requires SUPABASE_URL as a bare project URL', () => {
    expect(() => loadConfig({})).toThrow(/SUPABASE_URL/)
    expect(() => loadConfig({ ...SUPABASE, SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co/' })).toThrow(/SUPABASE_URL/)
  })

  it('requires the publishable key', () => {
    expect(() => loadConfig({ SUPABASE_URL: SUPABASE.SUPABASE_URL })).toThrow(/SUPABASE_PUBLISHABLE_KEY/)
  })
})
