import { Controller, Get, Query } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('api/v1/market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('snapshot')
  getSnapshot(@Query('codes') codes = '') {
    return this.marketService.getSnapshot(codes.split(',').map((v) => v.trim()).filter(Boolean));
  }

  @Get('candles')
  getCandles(@Query('code') code = '', @Query('tf') tf: '1d' | '5m' = '1d', @Query('count') count = '200') {
    const n = Number(count);
    const safe = Number.isFinite(n) ? Math.max(10, Math.min(500, n)) : 200;
    return this.marketService.getCandles(code, tf, safe);
  }
}
