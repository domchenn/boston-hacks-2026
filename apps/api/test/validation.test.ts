/**
 * Unit tests for ZodValidationPipe: parsed values pass through, failures become a
 * 400 that lists each field problem.
 */
import { describe, expect, it } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../src/common/zod-validation.pipe.js'

const pipe = new ZodValidationPipe(z.object({ id: z.uuid(), limit: z.coerce.number().int().min(1).max(50).default(20) }))

describe('ZodValidationPipe', () => {
  it('returns the parsed value, with coercion and defaults', () => {
    expect(pipe.transform({ id: '11111111-2222-4333-8444-555555555555', limit: '5' })).toEqual({
      id: '11111111-2222-4333-8444-555555555555',
      limit: 5,
    })
    expect(pipe.transform({ id: '11111111-2222-4333-8444-555555555555' }).limit).toBe(20)
  })

  it('rejects bad input with a 400 naming every field', () => {
    try {
      pipe.transform({ id: 'nope', limit: '500' })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      const messages = (error as BadRequestException).getResponse() as { message: string[] }
      expect(messages.message.join(' ')).toMatch(/id:/)
      expect(messages.message.join(' ')).toMatch(/limit:/)
    }
  })
})
