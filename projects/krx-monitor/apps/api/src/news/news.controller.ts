import { Controller, Get, Query } from '@nestjs/common';

@Controller('api/v1/news')
export class NewsController {
  @Get()
  getNews(@Query('code') code = '', @Query('limit') limit = '5') {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(20, parsedLimit)) : 5;

    return Array.from({ length: safeLimit }, (_, idx) => {
      const minutesAgo = idx * 13 + (code.charCodeAt(0) || 1);
      return {
        id: `${code}-${idx + 1}`,
        code,
        title: `${code} 관련 Mock 뉴스 헤드라인 ${idx + 1}`,
        summary: `랜덤워크 기반 시세 변동과 거래량 증가/감소를 반영한 더미 기사 요약입니다 (${idx + 1}).`,
        publishedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      };
    });
  }
}
