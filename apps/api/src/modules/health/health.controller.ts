import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@finance/shared';
import { AppConfigService } from '../../config/app-config.service';
import { Public } from '../auth/decorators/public.decorator';
import { APP_VERSION } from '../../version';

/** Liveness: `GET /health` (Docker HEALTHCHECK) and `GET /` (platform default probes) return the same payload. */
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly config: AppConfigService) {}

  @Public()
  @Get('health')
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'my-cashify-api',
      version: APP_VERSION,
      environment: this.config.nodeEnv,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }

  @Public()
  @Get()
  root(): HealthResponse {
    return this.check();
  }
}
