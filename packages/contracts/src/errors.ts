/**
 * The API's error response shape, shared by every endpoint.
 */
import { z } from 'zod'

export const ApiErrorBody = z.object({
  /** Machine-readable code, e.g. not_found, unauthorized, bad_request. */
  error: z.string(),
  /** Human-readable explanation, safe to show. */
  message: z.string(),
  /** Matches the response's x-request-id header; quote it when reporting a problem. */
  requestId: z.string(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBody>
