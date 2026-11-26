/**
 * GET /v1/meta: the API's name, version and environment. A first versioned
 * endpoint so clients and tests can confirm which deployment they reach.
 */
import { Controller, Get, Inject } from '@nestjs/common'
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators.js'
import { APP_CONFIG, type AppConfig } from '../config/env.js'
import { API_VERSION } from '../version.js'

class MetaResponse {
  @ApiProperty({ example: 'breadcrumb-api' })
  name!: string

  @ApiProperty({ example: '0.1.0' })
  version!: string

  @ApiProperty({ enum: ['local', 'staging', 'production'] })
  environment!: AppConfig['APP_ENV']
}

@ApiTags('meta')
@Public()
@Controller('v1/meta')
export class MetaController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  @ApiOkResponse({ type: MetaResponse })
  get(): MetaResponse {
    return { name: 'breadcrumb-api', version: API_VERSION, environment: this.config.APP_ENV }
  }
}
