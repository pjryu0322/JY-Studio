"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OpsRange, OpsSummaryDto } from "@/lib/ops-dto";
import { fetchOpsSummary } from "@/lib/ops-api";
import { ROUTES } from "@/lib/routes";

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const OPS_LINKS = [
  { title: "Quota", description: "client별 사용량/429", href: ROUTES.adminOpsQuota },
  { title: "API Keys", description: "발급·폐기·상태", href: ROUTES.adminOpsApiKeys },
  { title: "Usage Log", description: "API 호출 로그", href: ROUTES.adminOpsUsage },
  { title: "Audit Log", description: "감사 로그", href: ROUTES.adminOpsAudit },
  { title: "Health", description: "DB/Context API 상태", href: ROUTES.adminOpsHealth },
  { title: "Plan / Billing", description: "무료 플랜 및 사용량 기준", href: ROUTES.adminOpsPlans },
] as const;

export function OpsSummaryPanel() {
  const [range, setRange] = useState<OpsRange>("24h");
  const [data, setData] = useState<OpsSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchOpsSummary(range));
    } catch (err) {
      setError(err instanceof Error ? err.message : "요약 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["24h", "7d"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${
              range === r ? "bg-store-accent text-white" : "border border-store-border bg-white text-slate-700"
            }`}
          >
            {r === "24h" ? "최근 24시간" : "최근 7일"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : data ? (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <MetricCard label="총 요청" value={String(data.totalRequests)} />
            <MetricCard label="오류율" value={formatPercent(data.errorRate)} />
            <MetricCard label="평균 latency" value={`${data.averageLatencyMs}ms`} />
            <MetricCard label="최대 latency" value={`${data.maxLatencyMs}ms`} />
            <MetricCard label="성공" value={String(data.successCount)} />
            <MetricCard label="오류" value={String(data.errorCount)} />
            <MetricCard label="고유 API Key" value={String(data.uniqueApiKeyCount)} />
          </dl>

          <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-slate-900">Rate limit 정책</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                plan: {data.rateLimitPolicy.plan}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                enforcement: {data.rateLimitPolicy.enforcement}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                blocking: {data.rateLimitPolicy.blockingEnabled ? "on" : "off"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                /min warn: {data.rateLimitPolicy.perMinuteWarning}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                /day warn: {data.rateLimitPolicy.perDayWarning}
              </span>
            </div>
            <p className="mt-2 text-xs text-store-muted">{data.rateLimitPolicy.description}</p>
          </div>

          {data.topEndpoints.length > 0 ? (
            <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
              <h2 className="text-sm font-bold text-slate-900">endpoint별 호출</h2>
              <ul className="mt-2 space-y-1 text-xs">
                {data.topEndpoints.map((item) => (
                  <li key={item.endpoint} className="flex flex-wrap items-center justify-between gap-2">
                    <code className="min-w-0 truncate text-slate-800">{item.endpoint}</code>
                    <span className="text-store-muted">
                      {item.count}회 · 오류 {item.errorCount} · {item.averageLatencyMs}ms
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.topPacks.length > 0 ? (
            <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
              <h2 className="text-sm font-bold text-slate-900">packId별 호출</h2>
              <ul className="mt-2 space-y-1 text-xs">
                {data.topPacks.map((item) => (
                  <li key={item.packId} className="flex items-center justify-between gap-2">
                    <code className="min-w-0 truncate text-slate-800">{item.packId}</code>
                    <span className="text-store-muted">{item.count}회</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-3">
        {OPS_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-[44px] flex-col justify-center rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
            >
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs text-store-muted">{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
      <dt className="text-xs text-store-muted">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-slate-900">{value}</dd>
    </div>
  );
}
