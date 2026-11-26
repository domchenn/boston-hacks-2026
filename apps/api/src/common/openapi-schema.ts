/**
 * Turns a shared Zod contract into an OpenAPI 3.0 schema object for @ApiOkResponse,
 * so the API docs come from the same definitions the clients validate against.
 */
import { z } from 'zod'

export function openApiSchema(type: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(type, { target: 'openapi-3.0', io: 'output' }) as Record<string, unknown>
}
