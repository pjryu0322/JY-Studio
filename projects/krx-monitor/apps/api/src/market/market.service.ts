import { Injectable } from '@nestjs/common';

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

type SnapshotState = {
  last: number;
  prevClose: number;
};

@Injectable()
export class MarketService {
  private state = new Map<string, SnapshotState>();

  private hash(input: string): number {
    let h = 0;
    for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
    return h;
  }

  private rand(seed: number): () => number {
    let s = seed || 1;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  private codeName(code: string) {
    return `Mock-${code}`;
  }

  getSnapshot(codes: string[]) {
    return codes.filter(Boolean).map((code) => {
      const seed = this.hash(code);
      const random = this.rand(seed + Math.floor(Date.now() / 2000));
      const existing = this.state.get(code);
      const base = 8000 + (seed % 90000);
      const prevClose = existing?.prevClose ?? base;
      const oldLast = existing?.last ?? base;
      const nextLast = Math.max(1000, oldLast + (random() - 0.5) * Math.max(30, oldLast * 0.003));
      const open = prevClose + (random() - 0.5) * Math.max(20, prevClose * 0.002);
      const high = Math.max(nextLast, open) + random() * 45;
      const low = Math.min(nextLast, open) - random() * 45;
      const volume = Math.floor(100000 + random() * 7000000);
      const value = Math.floor(volume * nextLast);
      const change = nextLast - prevClose;
      const changePct = (change / prevClose) * 100;

      this.state.set(code, { last: nextLast, prevClose });

      return {
        code,
        name: this.codeName(code),
        last: Math.round(nextLast),
        prevClose: Math.round(prevClose),
        change: Math.round(change),
        changePct: Number(changePct.toFixed(2)),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        volume,
        value,
        time: new Date().toISOString(),
      };
    });
  }

  getCandles(code: string, tf: '1d' | '5m', count: number): Candle[] {
    const step = tf === '1d' ? 86400 : 300;
    const now = Math.floor(Date.now() / 1000);
    const seed = this.hash(`${code}:${tf}`);
    const random = this.rand(seed);
    let price = 9000 + (seed % 70000);
    const candles: Candle[] = [];

    for (let i = count - 1; i >= 0; i -= 1) {
      const open = price;
      const drift = (random() - 0.48) * (tf === '1d' ? 380 : 90);
      const close = Math.max(1000, open + drift);
      const high = Math.max(open, close) + random() * 60;
      const low = Math.min(open, close) - random() * 60;
      const volume = Math.floor(50000 + random() * 2000000);
      candles.push({
        time: now - i * step,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume,
      });
      price = close;
    }

    return candles;
  }
}
