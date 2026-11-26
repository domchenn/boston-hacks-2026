/**
 * Tests for loadConfig(): defaults, parsing and the readable error for bad values.
 */
import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../src/config/env.js'

describe('loadConfig', () => {
  it('uses safe local defaults', () => {
    const config = loadConfig({})
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      PORT: 3001,
      CORS_ORIGINS: ['http://localhost:5173'],
    })
  })

  it('parses a comma-separated origin list and a numeric port', () => {
    const config = loadConfig({
      PORT: '8080',
      CORS_ORIGINS: 'https://breadcrumb.boston, https://breadcrumb-staging-seven.vercel.app',
    })
    expect(config.PORT).toBe(8080)
    expect(config.CORS_ORIGINS).toEqual(['https://breadcrumb.boston', 'https://breadcrumb-staging-seven.vercel.app'])
  })

  it('rejects bad values with one readable message listing every problem', () => {
    const attempt = () => loadConfig({ PORT: 'abc', APP_ENV: 'prod', CORS_ORIGINS: 'https://x.com/,nope' })
    expect(attempt).toThrow(ConfigError)
    expect(attempt).toThrow(/PORT/)
    expect(attempt).toThrow(/APP_ENV/)
    expect(attempt).toThrow(/CORS_ORIGINS\.0/)
    expect(attempt).toThrow(/CORS_ORIGINS\.1/)
  })

  it('rejects an empty origin list', () => {
    expect(() => loadConfig({ CORS_ORIGINS: ' , ' })).toThrow(/at least one origin/)
  })
})
