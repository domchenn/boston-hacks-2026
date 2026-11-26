/**
 * GET /health: liveness check for the host (outside /v1 so it never changes with
 * the API version). Does not touch the database.
 */
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'

class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: 'ok'
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok' }
  }
}
