import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MarketController } from './market/market.controller';
import { MarketService } from './market/market.service';
import { NewsController } from './news/news.controller';
import { PrismaService } from './prisma/prisma.service';
import { StocksController } from './stocks/stocks.controller';
import { WatchController } from './watch/watch.controller';
import { WatchService } from './watch/watch.service';

@Module({
  controllers: [HealthController, WatchController, StocksController, MarketController, NewsController],
  providers: [PrismaService, WatchService, MarketService],
})
export class AppModule {}
