import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      ts: new Date().toISOString(),
    };
  }
}
