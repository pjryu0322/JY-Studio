import { Injectable } from '@nestjs/common';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

@Injectable()
export class MarketService {
  private hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private seeded(seed: number): () => number {
    let s = seed || 1;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  generateCandles(code: string, tf: '1d' | '5m' = '5m', count = 120): Candle[] {
    const stepSec = tf === '1d' ? 86400 : 300;
    const seed = this.hashCode(`${code}:${tf}:${count}`);
    const random = this.seeded(seed);

    const nowSec = Math.floor(Date.now() / 1000);
    const base = 10000 + (seed % 50000);
    let prev = base;

    const candles: Candle[] = [];

    for (let i = count - 1; i >= 0; i -= 1) {
      const drift = (random() - 0.48) * (tf === '1d' ? 500 : 120);
      const open = prev;
      const close = Math.max(500, open + drift);
      const high = Math.max(open, close) + random() * 80;
      const low = Math.min(open, close) - random() * 80;
      const volume = Math.floor(10000 + random() * 300000);

      candles.push({
        time: nowSec - i * stepSec,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });

      prev = close;
    }

    return candles;
  }

  getSnapshot(codes: string[]) {
    return codes
      .filter((code) => code.trim().length > 0)
      .map((code) => {
        const candles = this.generateCandles(code, '5m', 2);
        const prev = candles[0]?.close ?? 0;
        const last = candles[1]?.close ?? prev;
        const change = last - prev;
        const changePct = prev === 0 ? 0 : (change / prev) * 100;

        return {
          code,
          price: Number(last.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePct: Number(changePct.toFixed(2)),
          volume: candles[1]?.volume ?? 0,
          ts: new Date().toISOString(),
        };
      });
  }
}
