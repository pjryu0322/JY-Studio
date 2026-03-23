"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  return "#b26a00"; // STARTED/그 외(진행중)
}

function stageLabel(stage: string): string {
  if (stage === "SELF_HEALING") return "AUTO RECOVERY";
  return stage;
}

export function ExecutionTimeline({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<ExecutionEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
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

      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setItems([]);
        setError(json.message || "실행 이벤트를 불러오지 못했습니다.");
        return;
      }
      setItems(json.data);
    } catch (e) {
      console.error("Failed to load execution timeline:", e);
      setItems([]);
      setError("실행 이벤트 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const maybeFetch = () => {
      if (cancelled) return;
      const detailsEl = rootRef.current?.closest("details");
      if (!detailsEl) {
        void load();
        return;
      }
      if (detailsEl.open) {
        void load();
      }
    };

    const detailsEl = rootRef.current?.closest("details");
    if (!detailsEl) {
      void load();
      return () => {
        cancelled = true;
      };
    }

    detailsEl.addEventListener("toggle", maybeFetch);
    maybeFetch();

    return () => {
      cancelled = true;
      detailsEl.removeEventListener("toggle", maybeFetch);
    };
  }, [jobId]);

  const stageGroups = useMemo(() => {
    // API는 createdAt asc로 내려오므로,
    // stage 내부 순서는 items 순서를 그대로 사용하고,
    // stage 그룹 순서는 stage의 "첫 등장(createdAt)" 순서를 유지합니다.
    const order: string[] = [];
    const byStage = new Map<string, ExecutionEventRow[]>();
    for (const row of items) {
      if (!byStage.has(row.stage)) {
        byStage.set(row.stage, []);
        order.push(row.stage);
      }
      byStage.get(row.stage)!.push(row);
    }
    return order.map((stage) => ({
      stage,
      events: byStage.get(stage) ?? [],
    }));
  }, [items]);

  return (
    <div ref={rootRef} style={{ marginTop: 8, borderTop: "1px dashed #ddd", paddingTop: 8 }}>
      <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "#555" }}>
        <strong>Execution Timeline</strong> ({jobId})
      </p>
      {loading ? <p style={{ margin: 0, fontSize: 12, color: "#666" }}>불러오는 중...</p> : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: "#b00020" }}>{error}</p> : null}
      {!loading && !error && stageGroups.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#666" }}>기록된 이벤트가 없습니다.</p>
      ) : null}
      {!loading && !error && stageGroups.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {stageGroups.map((group) => (
            <div key={group.stage} style={{ paddingBottom: 2 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {group.stage === "SELF_HEALING" ? "🔵 " : null}
                      {stageLabel(group.stage)}
                    </span>
                <span style={{ color: "#666", fontSize: 12 }}>({group.events.length} events)</span>
              </div>

              <div
                style={{
                  position: "relative",
                  paddingLeft: 18,
                  borderLeft: "2px solid #eee",
                }}
              >
                {group.events.map((ev, idx) => {
                  const color = group.stage === "SELF_HEALING" ? "#1e64ff" : statusColor(ev.status);
                  const durationText = ev.durationMs == null ? null : `${ev.durationMs}ms`;
                  return (
                    <div
                      key={`${group.stage}-${ev.status}-${ev.createdAt}-${idx}`}
                      style={{
                        position: "relative",
                        marginBottom: idx === group.events.length - 1 ? 0 : 10,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: -7,
                          top: 3,
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: color,
                          boxShadow: "0 0 0 2px rgba(0,0,0,0.04)",
                        }}
                      />
                      <div style={{ fontSize: 12, color: "#333" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ color, fontWeight: 700 }}>{ev.status}</span>
                          <span style={{ color: "#666" }}>
                            {durationText ? `duration: ${durationText}` : null}
                          </span>
                        </div>
                        <div style={{ color: "#333", marginTop: 2, lineHeight: 1.4 }}>
                          {ev.message ? ev.message : <span style={{ color: "#999" }}>-</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
