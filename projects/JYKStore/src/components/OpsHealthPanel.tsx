"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsHealthDto } from "@/lib/ops-dto";
import { fetchOpsHealth } from "@/lib/ops-api";

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function OpsHealthPanel() {
  const [data, setData] = useState<OpsHealthDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchOpsHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health 상태를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;
  }

  if (loading && !data) {
    return <p className="text-sm text-store-muted">불러오는 중…</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Database</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              data.database.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}
          >
            {data.database.ok ? "OK" : "DOWN"}
          </span>
          <span className="text-store-muted">latency {data.database.latencyMs}ms</span>
        </div>
      </div>

      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">Context API (최근 24시간)</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>요청 수: {data.contextApi.recentRequestCount}</div>
          <div>오류 수: {data.contextApi.recentErrorCount}</div>
          <div>오류율: {formatPercent(data.contextApi.recentErrorRate)}</div>
          <div>평균 latency: {data.contextApi.averageLatencyMs}ms</div>
        </dl>
      </div>

      <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
        <h2 className="text-sm font-bold text-slate-900">데이터 현황</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>공개 pack: {data.data.publishedPackCount}</div>
          <div>REVIEWING pack: {data.data.reviewingPackCount}</div>
          <div>active chunk: {data.data.activeChunkCount}</div>
          <div>API Key: {data.data.apiKeyCount}</div>
        </dl>
      </div>

      <p className="text-xs text-store-muted">생성 시각: {new Date(data.generatedAt).toLocaleString("ko-KR")}</p>
    </div>
  );
}
