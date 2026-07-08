"use client";

import { FormEvent, useCallback, useState } from "react";
import type { ApiKeyDto, ApiKeyDtoStatus } from "@/lib/api-key-dto";
import { apiKeyStatusLabel } from "@/lib/api-key-dto";
import { fetchAdminApiKeys, revokeAdminApiKey } from "@/lib/admin-api-keys-api";

const STATUS_FILTERS: Array<ApiKeyDtoStatus | "ALL"> = ["ALL", "ACTIVE", "REVOKED", "EXPIRED"];

export function AdminApiKeysPanel() {
  /** Held only in React state — never written to localStorage/sessionStorage. */
  const [appliedToken, setAppliedToken] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [status, setStatus] = useState<ApiKeyDtoStatus | "ALL">("ALL");
  const [items, setItems] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = useCallback(
    async (token: string, filterStatus: ApiKeyDtoStatus | "ALL") => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminApiKeys({
          status: filterStatus === "ALL" ? undefined : filterStatus,
          adminToken: token,
        });
        setItems(data.apiKeys);
      } catch (err) {
        setItems([]);
        setError(err instanceof Error ? err.message : "API Key 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

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
      await refresh(trimmed, status);
    },
    [refresh, status, tokenDraft],
  );

  const onChangeStatus = useCallback(
    async (next: ApiKeyDtoStatus | "ALL") => {
      setStatus(next);
      if (!appliedToken) return;
      await refresh(appliedToken, next);
    },
    [appliedToken, refresh],
  );

  const onRevoke = useCallback(
    async (apiKeyId: string) => {
      if (!appliedToken) return;
      const ok = window.confirm("이 API Key를 폐기할까요? 폐기 후에는 복구할 수 없습니다.");
      if (!ok) return;

      setRevokingId(apiKeyId);
      setError(null);
      try {
        await revokeAdminApiKey(apiKeyId, appliedToken);
        await refresh(appliedToken, status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "API Key를 폐기하지 못했습니다.");
      } finally {
        setRevokingId(null);
      }
    },
    [appliedToken, refresh, status],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={onApplyToken}
        className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
      >
        <label htmlFor="admin-ops-token" className="block text-xs font-semibold text-slate-700">
          Admin Ops Token
        </label>
        <p className="mt-1 text-xs text-store-muted">
          `JYKSTORE_ADMIN_OPS_TOKEN`과 동일한 값을 입력합니다. React state에만 보관하며
          localStorage/sessionStorage에는 저장하지 않습니다. 새로고침 시 다시 입력해야 합니다.
        </p>
        <input
          id="admin-ops-token"
          name="adminOpsToken"
          type="password"
          autoComplete="off"
          value={tokenDraft}
          onChange={(e) => setTokenDraft(e.target.value)}
          placeholder={appliedToken ? "토큰이 적용됨 — 변경 시 다시 입력" : "Admin Ops Token"}
          className="mt-3 min-h-[44px] w-full rounded-xl border border-store-border px-3 text-sm"
        />
        <button
          type="submit"
          className="mt-3 min-h-[44px] w-full rounded-xl bg-store-accent px-4 text-sm font-bold text-white active:opacity-90"
        >
          적용
        </button>
        {appliedToken ? (
          <p className="mt-2 text-[10px] text-green-700">토큰이 적용되었습니다. (원문은 표시하지 않음)</p>
        ) : null}
      </form>

      {!appliedToken ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-store-muted">
          Admin Ops Token을 적용한 뒤 목록을 조회합니다.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => void onChangeStatus(value)}
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
                        onClick={() => onRevoke(apiKey.id)}
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
        </>
      )}
    </div>
  );
}
