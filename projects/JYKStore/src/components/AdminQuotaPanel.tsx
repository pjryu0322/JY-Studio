"use client";

import { FormEvent, useCallback, useState } from "react";
import { fetchAdminQuotaSummary } from "@/lib/admin-quota-api";
import type { QuotaSummaryDto, QuotaSummaryRange } from "@/lib/quota-service";

export function AdminQuotaPanel() {
  const [appliedToken, setAppliedToken] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
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
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = tokenDraft.trim();
      if (!trimmed) {
        setError("Admin Ops Token을 입력하세요.");
        return;
      }
      setAppliedToken(trimmed);
      setTokenDraft("");
      await refresh(trimmed, range);
    },
    [range, refresh, tokenDraft],
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
      <form
        onSubmit={onApplyToken}
        className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
      >
        <label htmlFor="admin-quota-token" className="block text-xs font-semibold text-slate-700">
          Admin Ops Token
        </label>
        <p className="mt-1 text-xs text-store-muted">
          React state에만 보관합니다. localStorage/sessionStorage에는 저장하지 않습니다.
        </p>
        <input
          id="admin-quota-token"
          type="password"
          autoComplete="off"
          value={tokenDraft}
          onChange={(e) => setTokenDraft(e.target.value)}
          placeholder={appliedToken ? "토큰이 적용됨 — 변경 시 다시 입력" : "Admin Ops Token"}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <button
          type="submit"
          className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white"
        >
          적용
        </button>
      </form>

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
              <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
                <h2 className="text-sm font-bold text-slate-900">Quota policy</h2>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <dt className="text-store-muted">Plan</dt>
                    <dd className="font-semibold">{summary.policy.plan}</dd>
                  </div>
                  <div>
                    <dt className="text-store-muted">Enforcement</dt>
                    <dd className="font-semibold">{summary.policy.enforcement}</dd>
                  </div>
                  <div>
                    <dt className="text-store-muted">Per minute</dt>
                    <dd className="font-semibold">{summary.policy.perMinuteRequests}</dd>
                  </div>
                  <div>
                    <dt className="text-store-muted">Per day</dt>
                    <dd className="font-semibold">{summary.policy.perDayRequests}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
                <h2 className="text-sm font-bold text-slate-900">요청 요약</h2>
                <p className="mt-2 text-sm text-slate-800">
                  총 요청 <span className="font-bold">{summary.totalRequests}</span> · 429/초과{" "}
                  <span className="font-bold text-red-700">{summary.quotaExceededCount}</span>
                </p>
              </section>

              <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
                <h2 className="text-sm font-bold text-slate-900">Top clients</h2>
                <ul className="mt-3 space-y-2">
                  {summary.topClients.length === 0 ? (
                    <li className="text-sm text-store-muted">데이터 없음</li>
                  ) : (
                    summary.topClients.map((client) => (
                      <li
                        key={client.clientId}
                        className="rounded-xl border border-slate-100 px-3 py-2 text-xs"
                      >
                        <p className="font-mono text-slate-800">{client.clientId}</p>
                        <p className="mt-1 text-store-muted">
                          requests {client.requestCount} · exceeded {client.quotaExceededCount} ·
                          keys {client.uniqueApiKeyCount}
                          {client.topEndpoint ? ` · ${client.topEndpoint}` : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="rounded-2xl border border-store-border bg-white p-4 shadow-card">
                <h2 className="text-sm font-bold text-slate-900">Top endpoints</h2>
                <ul className="mt-3 space-y-2">
                  {summary.topEndpoints.map((item) => (
                    <li
                      key={item.endpoint}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 break-all font-mono text-slate-800">
                        {item.endpoint}
                      </span>
                      <span className="shrink-0 font-bold text-slate-700">{item.requestCount}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
