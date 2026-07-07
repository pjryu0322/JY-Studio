"use client";

import { useCallback, useEffect, useState } from "react";
import { FreePlanPolicyCard } from "@/components/FreePlanPolicyCard";
import { UsageAllowanceCard } from "@/components/UsageAllowanceCard";
import { fetchAccountPlanSummary } from "@/lib/billing-api";
import type { PlanUsageSummaryDto } from "@/lib/billing-dto";
import { maskId } from "@/lib/masking";

export function AccountPlanPanel() {
  const [summary, setSummary] = useState<PlanUsageSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await fetchAccountPlanSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : "플랜 정보를 불러오지 못했습니다.");
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
        차단하지 않습니다. 향후 유료화가 필요한 경우 Plan/Billing 구조를 확장할 수 있도록 기반만 제공합니다.
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && !summary ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : summary ? (
        <>
          <FreePlanPolicyCard plan={summary.plan} />
          <UsageAllowanceCard summary={summary} />

          <div className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
            <h2 className="text-sm font-bold text-slate-900">결제</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>결제 사용: {summary.billing.billingEnabled ? "on" : "off"}</div>
              <div>결제 필요: {summary.billing.paymentRequired ? "필요" : "없음"}</div>
              <div>현재 청구액: {summary.billing.currentAmountKrw.toLocaleString("ko-KR")}원</div>
              <div>다음 청구일: {summary.billing.nextBillingAt ?? "없음"}</div>
            </dl>
            <p className="mt-2 text-xs text-store-muted">{summary.billing.message}</p>
          </div>

          <p className="text-xs text-store-muted">
            기기/계정별 상세 사용량은 향후 로그인/계정 기능에서 제공됩니다. 현재 clientId는 화면 식별용으로만
            표시됩니다: <span className="font-mono">{maskId(summary.clientId)}</span>
          </p>
        </>
      ) : null}
    </div>
  );
}
