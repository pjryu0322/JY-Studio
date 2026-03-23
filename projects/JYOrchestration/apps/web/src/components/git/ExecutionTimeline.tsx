"use client";

import { useEffect, useMemo, useState } from "react";
import { mockAuthHeaders } from "@/lib/auth/requestUser";

type ExecutionEventRow = {
  stage: string;
  status: string;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
};

function statusColor(status: string): string {
  if (status === "SUCCESS") return "#0a7d2e";
  if (status === "FAILED") return "#b00020";
  return "#b26a00";
}

export function ExecutionTimeline({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<ExecutionEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ jobId });
        const res = await fetch(`/api/execution-events?${q.toString()}`, {
          headers: mockAuthHeaders(),
        });
        const json = (await res.json()) as {
          success: boolean;
          message?: string;
          data?: ExecutionEventRow[];
        };
        if (cancelled) return;
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          setItems([]);
          setError(json.message || "실행 이벤트를 불러오지 못했습니다.");
          return;
        }
        setItems(json.data);
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load execution timeline:", e);
        setItems([]);
        setError("실행 이벤트 조회 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const grouped = useMemo(() => items, [items]);

  return (
    <div style={{ marginTop: 8, borderTop: "1px dashed #ddd", paddingTop: 8 }}>
      <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "#555" }}>
        <strong>Execution Timeline</strong> ({jobId})
      </p>
      {loading ? <p style={{ margin: 0, fontSize: 12, color: "#666" }}>불러오는 중...</p> : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: "#b00020" }}>{error}</p> : null}
      {!loading && !error && grouped.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#666" }}>기록된 이벤트가 없습니다.</p>
      ) : null}
      {!loading && !error && grouped.length > 0 ? (
        <div style={{ display: "grid", gap: 4 }}>
          {grouped.map((row, idx) => (
            <div
              key={`${row.stage}-${row.status}-${idx}`}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 90px 80px 1fr",
                gap: 8,
                fontSize: 12,
                alignItems: "center",
                padding: "4px 0",
              }}
            >
              <span style={{ fontWeight: 600 }}>{row.stage}</span>
              <span style={{ color: statusColor(row.status), fontWeight: 600 }}>{row.status}</span>
              <span style={{ color: "#666" }}>
                {row.durationMs == null ? "-" : `${row.durationMs}ms`}
              </span>
              <span style={{ color: "#333" }}>{row.message ?? "-"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
