'use client';

import { createChart, IChartApi } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { Candle } from '../_types/monitor';

type Props = {
  code?: string;
  candles: Candle[];
  onInteraction: () => void;
};

function sma(values: Candle[], period: number) {
  return values
    .map((candle, index) => {
      if (index < period - 1) {
        return null;
      }
      const slice = values.slice(index - period + 1, index + 1);
      const avg = slice.reduce((acc, item) => acc + item.close, 0) / period;
      return { time: candle.time as never, value: Number(avg.toFixed(2)) };
    })
    .filter(Boolean) as { time: never; value: number }[];
}

export function ChartPanel({ code, candles, onInteraction }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const chart = createChart(ref.current, {
      height: 330,
      layout: { background: { color: '#ffffff' }, textColor: '#1f2937' },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: { borderColor: '#e5e7eb' },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries();
    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    const ma5 = chart.addLineSeries({ color: '#ef4444', lineWidth: 1 });
    const ma20 = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 });
    const ma60 = chart.addLineSeries({ color: '#16a34a', lineWidth: 1 });
    const ma120 = chart.addLineSeries({ color: '#9333ea', lineWidth: 1 });

    candleSeries.setData(candles as never);
    volumeSeries.setData(
      candles.map((candle) => ({
        time: candle.time as never,
        value: candle.volume,
        color: candle.close >= candle.open ? '#ef444455' : '#3b82f655',
      })),
    );

    ma5.setData(sma(candles, 5));
    ma20.setData(sma(candles, 20));
    ma60.setData(sma(candles, 60));
    ma120.setData(sma(candles, 120));

    chart.timeScale().fitContent();

    const onMouseDown = () => onInteraction();
    ref.current.addEventListener('mousedown', onMouseDown);

    const ro = new ResizeObserver(() => {
      if (ref.current) {
        chart.applyOptions({ width: ref.current.clientWidth });
      }
    });
    ro.observe(ref.current);

    return () => {
      ref.current?.removeEventListener('mousedown', onMouseDown);
      ro.disconnect();
      chart.remove();
    };
  }, [candles, onInteraction]);

  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: 8 }}>
      <h3 style={{ margin: '4px 0 8px' }}>차트 {code ? `(${code})` : ''}</h3>
      <div ref={ref} style={{ width: '100%', minHeight: 330 }} />
    </section>
  );
}
