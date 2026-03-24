"use client";

import { useEffect, useMemo, useRef, useState } from "react";
type ExecutionEventRow = {
  stage: string;
  status: string;
  message: string | null;
  durationMs: number | null;
  createdAt: string;
  detailJson?: {
    failureType?: string;
    strategies?: string[];
    createdTasks?: Array<{
      strategy: string;
      taskId: string;
    }>;
    sourceTaskId?: string | null;
    created?: boolean;
    reason?: string | null;
    autoRunTriggered?: boolean;
    autoRunExecutedTaskIds?: string[];
    autoRunSkippedTaskIds?: string[] | Array<{ taskId: string; reason?: string }>;
  } | null;
};

const AUTO_HEALING_COLOR = "#2563eb";
const AUTO_RUN_ACTIVE = "#0a7d2e";
const AUTO_RUN_IDLE = "#64748b";
const COUNT_EXECUTED = "#0a7d2e";
const COUNT_SKIPPED = "#c2410c";
const REASON_EMPHASIS = "#c2410c";

function statusColor(status: string): string {
  if (status === "SUCCESS") return "#0a7d2e";
  if (status === "FAILED") return "#b00020";
  return "#b26a00";
}

function stageLabel(stage: string): string {
  if (stage === "SELF_HEALING") return "AUTO RECOVERY";
  return stage;
}

/** SELF_HEALING 전용: 문자열 message 필드는 사용하지 않고 detailJson만 렌더한다. */
function SelfHealingStructuredBody({ detailJson }: { detailJson: ExecutionEventRow["detailJson"] }) {
  if (detailJson == null) {
    return <div style={{ color: "#999" }}>(no structured self-healing data)</div>;
  }

  const d = detailJson;
  const createdTasks = Array.isArray(d.createdTasks) ? d.createdTasks : [];
  const createdCount = createdTasks.length;
  const strategies = Array.isArray(d.strategies) ? d.strategies : [];
  const strategiesLine = strategies.filter((s): s is string => typeof s === "string").join(", ");

  const executedCount = Array.isArray(d.autoRunExecutedTaskIds) ? d.autoRunExecutedTaskIds.length : 0;
  const skippedCount = Array.isArray(d.autoRunSkippedTaskIds) ? d.autoRunSkippedTaskIds.length : 0;

  const autoRunStateKnown = d.autoRunTriggered === true || d.autoRunTriggered === false;

  return (
    <div style={{ color: "#333", marginTop: 2, lineHeight: 1.45 }}>
      {d.created === true ? (
        <div style={{ fontWeight: 800 }}>
          Task 생성됨{" "}
          <span style={{ color: AUTO_HEALING_COLOR }}>({createdCount} tasks)</span>
        </div>
      ) : null}
      {d.created === false ? (
        <div style={{ fontWeight: 800 }}>
          생성 실패
          {d.reason != null && String(d.reason).length > 0 ? (
            <>
              {" "}
              <span style={{ fontWeight: 800, color: REASON_EMPHASIS }}>{String(d.reason)}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {d.created !== true && d.created !== false && d.reason != null && String(d.reason).length > 0 ? (
        <div style={{ marginTop: 4, fontWeight: 700, color: REASON_EMPHASIS }}>{String(d.reason)}</div>
      ) : null}

      {d.failureType ? (
        <div style={{ marginTop: 6 }}>
          failureType: <strong style={{ color: AUTO_HEALING_COLOR }}>{d.failureType}</strong>
        </div>
      ) : null}

      {strategies.length > 0 ? (
        <div style={{ marginTop: 4 }}>
          strategies: <strong style={{ color: "#1d4ed8" }}>{strategiesLine}</strong>
        </div>
      ) : null}

      {createdTasks.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <div>
            <strong>Created Tasks ({createdTasks.length})</strong>
          </div>
          <div style={{ marginTop: 4 }}>
            {createdTasks.map((t, i) => {
              const taskIdDisplay =
                typeof t.taskId === "string" && t.taskId ? t.taskId : "—";
              const rowKey = typeof t.taskId === "string" && t.taskId ? t.taskId : `row-${i}`;
              const strat = typeof t.strategy === "string" ? t.strategy : "UNKNOWN";
              return (
                <div key={rowKey}>
                  - <strong>{strat}</strong> ({taskIdDisplay})
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {d.autoRunTriggered === true ? (
        <div style={{ marginTop: 10 }}>
          <strong style={{ color: AUTO_RUN_ACTIVE }}>Auto Run: ACTIVE</strong>
        </div>
      ) : null}
      {d.autoRunTriggered === false ? (
        <div style={{ marginTop: 10 }}>
          <strong style={{ color: AUTO_RUN_IDLE }}>Auto Run: NOT TRIGGERED</strong>
        </div>
      ) : null}

      {autoRunStateKnown ? (
        <div style={{ marginTop: 4 }}>
          executed:{" "}
          <strong style={{ color: executedCount > 0 ? COUNT_EXECUTED : AUTO_RUN_IDLE }}>{executedCount}</strong>
          , skipped:{" "}
          <strong style={{ color: skippedCount > 0 ? COUNT_SKIPPED : AUTO_RUN_IDLE }}>{skippedCount}</strong>
        </div>
      ) : null}
    </div>
  );
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
        credentials: "include",
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
            <div
              key={group.stage}
              style={
                group.stage === "SELF_HEALING"
                  ? {
                      padding: 12,
                      borderRadius: 10,
                      border: `1px solid ${AUTO_HEALING_COLOR}55`,
                      background: "#eff6ff",
                      marginTop: 10,
                      marginBottom: 10,
                    }
                  : { paddingBottom: 2 }
              }
            >
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
                  const color = group.stage === "SELF_HEALING" ? AUTO_HEALING_COLOR : statusColor(ev.status);
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
                        {group.stage === "SELF_HEALING" ? (
                          <SelfHealingStructuredBody detailJson={ev.detailJson} />
                        ) : (
                          <div style={{ color: "#333", marginTop: 2, lineHeight: 1.4 }}>
                            {ev.message ? ev.message : <span style={{ color: "#999" }}>-</span>}
                          </div>
                        )}
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
