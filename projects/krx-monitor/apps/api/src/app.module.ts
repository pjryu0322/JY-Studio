import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
import { StocksController } from './stocks/stocks.controller';
import { WatchController } from './watch/watch.controller';
import { WatchService } from './watch/watch.service';

@Module({
  controllers: [HealthController, WatchController, StocksController],
  providers: [PrismaService, WatchService],
})
export class AppModule {}
