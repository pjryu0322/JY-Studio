import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
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

  @Get(':code/memo')
  async getMemo(@Param('code') code: string) {
    const memo = await this.prisma.stock_memo.findUnique({ where: { code } });
    return memo ?? { code, content: '', updated_at: null };
  }

  @Put(':code/memo')
  async putMemo(@Param('code') code: string, @Body() body: { content: string }) {
    return this.prisma.stock_memo.upsert({
      where: { code },
      create: { code, content: body.content ?? '' },
      update: { content: body.content ?? '' },
    });
  }
}
