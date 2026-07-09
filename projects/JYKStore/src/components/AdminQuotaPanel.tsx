"use client";

import { useCallback, useState } from "react";
import { AdminOpsTokenForm } from "@/components/AdminOpsTokenForm";
import { QuotaPolicyCard } from "@/components/QuotaPolicyCard";
import { QuotaRequestSummaryCard } from "@/components/QuotaRequestSummaryCard";
import { QuotaTopClientsList } from "@/components/QuotaTopClientsList";
import { QuotaTopEndpointsList } from "@/components/QuotaTopEndpointsList";
import { fetchAdminQuotaSummary } from "@/lib/admin-quota-api";
import type { QuotaSummaryDto, QuotaSummaryRange } from "@/lib/quota-service";

export function AdminQuotaPanel() {
  const [appliedToken, setAppliedToken] = useState<string | null>(null);
  const [range, setRange] = useState<QuotaSummaryRange>("24h");
  const [summary, setSummary] = useState<QuotaSummaryDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (token: string, nextRange: QuotaSummaryRange) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminQuotaSummary({
        range: nextRange,
        adminToken: token,
      });
      setSummary(data.summary);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Quota 요약을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onApplyToken = useCallback(
    async (token: string) => {
      if (!token.trim()) {
        setError("Admin Ops Token을 입력하세요.");
        return;
      }
      setAppliedToken(token);
      setError(null);
      await refresh(token, range);
    },
    [range, refresh],
  );

  const onChangeRange = useCallback(
    async (next: QuotaSummaryRange) => {
      setRange(next);
      if (!appliedToken) return;
      await refresh(appliedToken, next);
    },
    [appliedToken, refresh],
  );

  return (
    <div className="space-y-4">
      <AdminOpsTokenForm applied={Boolean(appliedToken)} onApply={onApplyToken} />

      {!appliedToken ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-store-muted">
          Admin Ops Token을 적용한 뒤 quota summary를 조회합니다.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(["24h", "7d"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => void onChangeRange(value)}
                className={`min-h-[44px] rounded-full px-3 text-xs font-bold ${
                  range === value
                    ? "bg-store-accent text-white"
                    : "border border-store-border bg-white text-slate-700"
                }`}
              >
                {value === "24h" ? "최근 24시간" : "최근 7일"}
              </button>
            ))}
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="min-h-[120px] rounded-2xl bg-slate-50" aria-hidden />
          ) : summary ? (
            <div className="space-y-4">
              <QuotaPolicyCard policy={summary.policy} />
              <QuotaRequestSummaryCard
                totalRequests={summary.totalRequests}
                quotaExceededCount={summary.quotaExceededCount}
              />
              <QuotaTopClientsList clients={summary.topClients} />
              <QuotaTopEndpointsList endpoints={summary.topEndpoints} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
