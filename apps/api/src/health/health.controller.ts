/**
 * GET /health: liveness check for the host (outside /v1 so it never changes with
 * the API version). Does not touch the database.
 */
import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators.js'

class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: 'ok'
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok' }
  }
}
