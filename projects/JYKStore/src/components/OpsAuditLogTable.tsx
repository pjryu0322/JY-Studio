"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsAuditLogItemDto } from "@/lib/ops-dto";
import { fetchOpsAuditLogs } from "@/lib/ops-api";

function formatShortTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpsAuditLogTable() {
  const [items, setItems] = useState<OpsAuditLogItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOpsAuditLogs({
        action: action.trim() || undefined,
        entityType: entityType.trim() || undefined,
        limit: 100,
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AuditLog를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [action, entityType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="action 필터 (예: ADMIN_CHUNK_CREATE)"
          className="min-h-[36px] flex-1 rounded-xl border border-store-border px-3 text-xs"
        />
        <input
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          placeholder="entityType 필터"
          className="min-h-[36px] min-w-[10rem] flex-1 rounded-xl border border-store-border px-3 text-xs sm:max-w-xs"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="text-sm text-store-muted">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-store-border bg-white p-4 text-sm text-store-muted">
          AuditLog가 없습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-xl border border-store-border bg-white p-2.5 shadow-sm ${
                  expanded ? "sm:col-span-2 xl:col-span-3" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="min-w-0 truncate rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-white"
                    title={item.action}
                  >
                    {item.action}
                  </span>
                  <time
                    className="shrink-0 text-[10px] tabular-nums text-store-muted"
                    dateTime={item.createdAt}
                    title={new Date(item.createdAt).toLocaleString("ko-KR")}
                  >
                    {formatShortTime(item.createdAt)}
                  </time>
                </div>

                <p className="mt-1.5 truncate text-[11px] font-medium text-slate-800" title={item.entityType}>
                  {item.entityType}
                </p>

                <dl className="mt-1.5 space-y-0.5 text-[10px] leading-snug text-store-muted">
                  <div className="flex gap-1 truncate">
                    <dt className="shrink-0">entity</dt>
                    <dd className="min-w-0 truncate font-mono text-slate-700" title={item.entityId ?? undefined}>
                      {item.entityId ?? "—"}
                    </dd>
                  </div>
                  <div className="flex gap-1 truncate">
                    <dt className="shrink-0">client</dt>
                    <dd className="min-w-0 truncate font-mono text-slate-700" title={item.clientId ?? undefined}>
                      {item.clientId ?? "—"}
                    </dd>
                  </div>
                </dl>

                {item.metadata ? (
                  <div className="mt-1.5 border-t border-store-border/70 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="text-[10px] font-semibold text-store-accent"
                    >
                      {expanded ? "metadata 접기" : "metadata"}
                    </button>
                    {expanded ? (
                      <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] leading-snug text-slate-700">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
