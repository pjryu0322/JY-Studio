import { Injectable } from '@nestjs/common';

@Injectable()
export class NewsService {
  private hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i += 1) h = (h * 33 + input.charCodeAt(i)) >>> 0;
    return h;
  }

  list(code: string, limit: number) {
    const seed = this.hash(code || 'KRX');
    const categories = ['공시', '수급', '실적', '이슈', '리포트'];
    const sources = ['연합', '매경', '한경', '이데일리', '머니투데이'];

    return Array.from({ length: limit }, (_, i) => {
      const c = categories[(seed + i) % categories.length];
      const s = sources[(seed + i * 3) % sources.length];
      return {
        id: `${code}-${seed}-${i + 1}`,
        ts: new Date(Date.now() - (i * 11 + (seed % 7)) * 60000).toISOString(),
        title: `${code} ${c} 관련 Mock 헤드라인 ${i + 1}`,
        source: s,
        category: c,
      };
    });
  }
}
