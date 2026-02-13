import { Controller, Get, Query } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('api/v1/market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('snapshot')
  getSnapshot(@Query('codes') codes?: string) {
    const parsed = (codes ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    return this.marketService.getSnapshot(parsed);
  }

  @Get('candles')
  getCandles(
    @Query('code') code = '',
    @Query('tf') tf: '1d' | '5m' = '5m',
    @Query('count') count = '120',
  ) {
    const parsedCount = Number(count);
    const safeCount = Number.isFinite(parsedCount) ? Math.max(10, Math.min(500, parsedCount)) : 120;

    return {
      code,
      tf,
      candles: this.marketService.generateCandles(code, tf, safeCount),
    };
  }
}
