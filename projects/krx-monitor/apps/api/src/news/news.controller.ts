import { Controller, Get, Query } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('api/v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  getNews(@Query('code') code = '', @Query('limit') limit = '50') {
    const n = Number(limit);
    const safe = Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 50;
    return this.newsService.list(code, safe);
  }
}
