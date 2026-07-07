"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsUsageLogItemDto } from "@/lib/ops-dto";
import { fetchOpsUsageLogs } from "@/lib/ops-api";

type StatusFilter = "" | "success" | "error";

function statusBadgeClass(statusCode: number): string {
  if (statusCode >= 500) return "bg-red-100 text-red-800";
  if (statusCode >= 400) return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

export function OpsUsageLogTable() {
  const [items, setItems] = useState<OpsUsageLogItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("");
  const [endpoint, setEndpoint] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOpsUsageLogs({
        status: status || undefined,
        endpoint: endpoint.trim() || undefined,
        limit: 100,
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "UsageLog를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [status, endpoint]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["", "success", "error"] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatus(s)}
            className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${
              status === s ? "bg-store-accent text-white" : "border border-store-border bg-white text-slate-700"
            }`}
          >
            {s === "" ? "전체" : s === "success" ? "성공" : "오류"}
          </button>
        ))}
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="endpoint 필터"
          className="min-h-[36px] flex-1 rounded-xl border border-store-border px-3 text-xs"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-sm text-store-muted">
          UsageLog가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-store-border bg-white p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(item.statusCode)}`}
                >
                  {item.statusCode}
                </span>
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                  {item.method || "—"}
                </span>
                <code className="min-w-0 flex-1 truncate text-xs text-slate-800">{item.endpoint}</code>
                <span className="text-xs text-store-muted">{item.latencyMs}ms</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-store-muted">
                <div>packId: {item.packId ?? "—"}</div>
                <div>apiKey: {item.apiKeyLabel}</div>
                <div className="col-span-2">query: {item.query ?? "—"}</div>
                <div className="col-span-2">{new Date(item.createdAt).toLocaleString("ko-KR")}</div>
              </dl>
              {item.metadata ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="text-[11px] font-semibold text-store-accent"
                  >
                    {expandedId === item.id ? "metadata 접기" : "metadata 보기"}
                  </button>
                  {expandedId === item.id ? (
                    <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-slate-50 p-2 text-[10px] text-slate-700">
                      {JSON.stringify(item.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
