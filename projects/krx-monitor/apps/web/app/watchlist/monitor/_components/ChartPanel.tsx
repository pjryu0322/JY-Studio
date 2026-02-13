'use client';

import { createChart } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { Candle } from '../_types/monitor';

function sma(data: Candle[], period: number) {
  return data
    .map((v, i) => {
      if (i < period - 1) return null;
      const avg = data.slice(i - period + 1, i + 1).reduce((a, c) => a + c.close, 0) / period;
      return { time: v.time as never, value: Number(avg.toFixed(2)) };
    })
    .filter(Boolean) as { time: never; value: number }[];
}

export function ChartPanel({ code, candles, onInteraction }: { code?: string; candles: Candle[]; onInteraction: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 330,
      layout: { background: { color: '#fff' }, textColor: '#111827' },
    });

    const cs = chart.addCandlestickSeries();
    const vs = chart.addHistogramSeries({ priceScaleId: '', priceFormat: { type: 'volume' } });
    const ma5 = chart.addLineSeries({ color: '#dc2626', lineWidth: 1 });
    const ma20 = chart.addLineSeries({ color: '#2563eb', lineWidth: 1 });
    const ma60 = chart.addLineSeries({ color: '#16a34a', lineWidth: 1 });
    const ma120 = chart.addLineSeries({ color: '#9333ea', lineWidth: 1 });

    cs.setData(candles as never);
    vs.setData(candles.map((c) => ({ time: c.time as never, value: c.volume, color: c.close >= c.open ? '#dc262655' : '#2563eb55' })));
    ma5.setData(sma(candles, 5));
    ma20.setData(sma(candles, 20));
    ma60.setData(sma(candles, 60));
    ma120.setData(sma(candles, 120));
    chart.timeScale().fitContent();

    const el = ref.current;
    const h = () => onInteraction();
    el.addEventListener('mousedown', h);
    el.addEventListener('wheel', h, { passive: true });
    el.addEventListener('mousemove', h);

    return () => {
      el.removeEventListener('mousedown', h);
      el.removeEventListener('wheel', h);
      el.removeEventListener('mousemove', h);
      chart.remove();
    };
  }, [candles, onInteraction]);

  return (
    <section style={{ border: '1px solid #ddd', background: '#fff', padding: 8 }}>
      <h3>차트 ({code ?? '-'})</h3>
      <div ref={ref} style={{ minHeight: 330 }} />
    </section>
  );
}
