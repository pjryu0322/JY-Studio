"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsAuditLogItemDto } from "@/lib/ops-dto";
import { fetchOpsAuditLogs } from "@/lib/ops-api";

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
          AuditLog가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-store-border bg-white p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                  {item.action}
                </span>
                <span className="text-xs text-slate-800">{item.entityType}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-store-muted">
                <div>entityId: {item.entityId ?? "—"}</div>
                <div>clientId: {item.clientId ?? "—"}</div>
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
