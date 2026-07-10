"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiKeyDto, ApiKeyDtoStatus } from "@/lib/api-key-dto";
import { apiKeyStatusLabel } from "@/lib/api-key-dto";
import { fetchAdminApiKeys, revokeAdminApiKey } from "@/lib/admin-api-keys-api";

const STATUS_FILTERS: Array<ApiKeyDtoStatus | "ALL"> = ["ALL", "ACTIVE", "REVOKED", "EXPIRED"];

export function AdminApiKeysPanel() {
  const [status, setStatus] = useState<ApiKeyDtoStatus | "ALL">("ALL");
  const [items, setItems] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = useCallback(async (filterStatus: ApiKeyDtoStatus | "ALL") => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminApiKeys({
        status: filterStatus === "ALL" ? undefined : filterStatus,
      });
      setItems(data.apiKeys);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "API Key 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(status);
  }, [refresh, status]);

  const onRevoke = useCallback(
    async (apiKeyId: string) => {
      const ok = window.confirm("이 API Key를 폐기할까요? 폐기 후에는 복구할 수 없습니다.");
      if (!ok) return;

      setRevokingId(apiKeyId);
      setError(null);
      try {
        await revokeAdminApiKey(apiKeyId);
        await refresh(status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "API Key를 폐기하지 못했습니다.");
      } finally {
        setRevokingId(null);
      }
    },
    [refresh, status],
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-store-muted">관리자 계정 세션으로 API Key를 조회·폐기합니다.</p>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`min-h-[44px] rounded-full px-3 text-xs font-bold ${
              status === value
                ? "bg-store-accent text-white"
                : "border border-store-border bg-white text-slate-700"
            }`}
          >
            {value === "ALL" ? "전체" : apiKeyStatusLabel(value)}
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
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-store-muted">
          표시할 API Key가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((apiKey) => {
            const inactive = apiKey.status !== "ACTIVE";
            return (
              <article
                key={apiKey.id}
                className={`rounded-2xl border p-4 shadow-card ${
                  inactive
                    ? "border-slate-200 bg-slate-50 opacity-80"
                    : "border-store-border bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-slate-900">{apiKey.name}</h2>
                    <p className="mt-1 font-mono text-xs text-slate-700">{apiKey.maskedKey}</p>
                    <p className="mt-2 text-[10px] text-store-muted">
                      {apiKey.clientId ? `client ${apiKey.clientId.slice(0, 10)}…` : "client —"}
                      {apiKey.lastUsedAt
                        ? ` · 마지막 사용 ${apiKey.lastUsedAt.slice(0, 10)}`
                        : null}
                      {apiKey.expiresAt ? ` · 만료 ${apiKey.expiresAt.slice(0, 10)}` : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {apiKey.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      apiKey.status === "ACTIVE"
                        ? "bg-green-50 text-green-700"
                        : apiKey.status === "EXPIRED"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {apiKeyStatusLabel(apiKey.status)}
                  </span>
                </div>
                {apiKey.status === "ACTIVE" ? (
                  <button
                    type="button"
                    disabled={revokingId === apiKey.id}
                    onClick={() => void onRevoke(apiKey.id)}
                    className="mt-4 min-h-[44px] w-full rounded-xl px-4 text-sm font-semibold text-red-600 active:bg-red-50 disabled:opacity-50"
                  >
                    {revokingId === apiKey.id ? "폐기 중…" : "API Key 폐기"}
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
