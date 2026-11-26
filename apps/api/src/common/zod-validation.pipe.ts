/**
 * Validates request input (body, query or params) against a Zod schema and returns
 * the parsed value. Failures become a 400 listing each problem by field. Use it per
 * parameter: @Body(new ZodValidationPipe(schema)).
 */
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data
    const problems = result.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    throw new BadRequestException(problems)
  }
}
