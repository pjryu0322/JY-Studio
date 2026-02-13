import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/stocks')
export class StocksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('search')
  async search(@Query('q') q?: string) {
    const keyword = (q ?? '').trim();

    if (!keyword) {
      return [];
    }

    return this.prisma.stock_master.findMany({
      where: {
        OR: [{ code: { contains: keyword, mode: 'insensitive' } }, { name: { contains: keyword, mode: 'insensitive' } }],
      },
      take: 20,
      orderBy: [{ code: 'asc' }],
      select: { code: true, name: true, market: true },
    });
  }
}
