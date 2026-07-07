"use client";

import { useCallback, useEffect, useState } from "react";
import { FreePlanPolicyCard } from "@/components/FreePlanPolicyCard";
import { fetchAdminPlanOverview } from "@/lib/billing-api";
import type { AdminPlanOverviewDto } from "@/lib/billing-dto";

export function AdminPlanOverviewPanel() {
  const [overview, setOverview] = useState<AdminPlanOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchAdminPlanOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-slate-800">
        현재 JYKStore는 전체 무료 정책으로 운영됩니다. 사용량은 운영 참고용으로만 집계되며, 초과 시 API 호출을
        차단하지 않습니다.
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && !overview ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : overview ? (
        <>
          <FreePlanPolicyCard plan={overview.plan} />

          <dl className="grid grid-cols-2 gap-2">
            <MetricCard label="총 API Key" value={overview.totalApiKeys.toLocaleString("ko-KR")} />
            <MetricCard label="추정 client 수" value={overview.totalClientsApprox.toLocaleString("ko-KR")} />
            <MetricCard label="오늘 Context 요청" value={overview.totalContextRequestsToday.toLocaleString("ko-KR")} />
            <MetricCard label="이번 달 Context 요청" value={overview.totalContextRequestsMonth.toLocaleString("ko-KR")} />
          </dl>

          <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-slate-900">결제 상태</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                billingEnabled: {overview.billingEnabled ? "true" : "false"}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                paymentRequired: {overview.paymentRequired ? "true" : "false"}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-slate-900">향후 유료화 확장 준비</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-store-muted">
              <li>Plan/Billing DTO 구조 준비 완료</li>
              <li>usage summary 집계 기반 확보</li>
              <li>실제 결제/청구/사용자별 plan assignment는 향후 별도 단계에서 확장</li>
            </ul>
          </div>
        </>
      ) : null}
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
