"use client";

import type { ApiKeyDto } from "@/lib/api-key-dto";
import { apiKeyStatusLabel } from "@/lib/api-key-dto";

export function ApiKeyCard({
  apiKey,
  onRevoke,
  revoking,
}: {
  readonly apiKey: ApiKeyDto;
  readonly onRevoke: (keyId: string) => void;
  readonly revoking: boolean;
}) {
  const inactive = apiKey.status !== "ACTIVE";

  return (
    <article
      className={`rounded-2xl border p-4 shadow-card ${
        inactive ? "border-slate-200 bg-slate-50 opacity-80" : "border-store-border bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">{apiKey.name}</h2>
          <p className="mt-1 font-mono text-xs text-slate-700">{apiKey.maskedKey}</p>
          <p className="mt-2 text-[10px] text-store-muted">
            생성 {apiKey.createdAt}
            {apiKey.lastUsedAt ? ` · 마지막 사용 ${apiKey.lastUsedAt.slice(0, 10)}` : null}
            {apiKey.expiresAt ? ` · 만료 ${apiKey.expiresAt.slice(0, 10)}` : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {apiKey.scopes.map((scope) => (
              <span key={scope} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
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
          disabled={revoking}
          onClick={() => onRevoke(apiKey.id)}
          className="mt-4 min-h-[44px] w-full rounded-xl px-4 text-sm font-semibold text-red-600 active:bg-red-50 disabled:opacity-50"
        >
          {revoking ? "폐기 중…" : "API Key 폐기"}
        </button>
      ) : null}
    </article>
  );
}
