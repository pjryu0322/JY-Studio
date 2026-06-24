"use client";

import { useMemo, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

function formatDuration(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return `${Math.round(ms)}ms`;
}

function formatRunListLabel(run: KnowledgePipelineRunRecord): string {
  const time = new Date(run.completedAt ?? run.startedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const status =
    run.status === "COMPLETED" ? "Completed" : run.status === "FAILED" ? "Failed" : "Running";
  return `${time} ${status} (${formatDuration(run.durationMs)})`;
}

function RunSummary(p: { readonly run: KnowledgePipelineRunRecord }) {
  const r = p.run;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        background: "#f8fafc",
        fontSize: 12,
      }}
    >
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Status</div>
        <div style={{ fontWeight: 900, color: t.textPrimary }}>{r.status}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Duration</div>
        <div style={{ fontWeight: 800 }}>{formatDuration(r.durationMs)}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Events</div>
        <div style={{ fontWeight: 800 }}>{r.eventCount ?? "—"}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Candidates</div>
        <div style={{ fontWeight: 800 }}>{r.candidateCount ?? "—"}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Nodes</div>
        <div style={{ fontWeight: 800 }}>{r.nodeCount ?? "—"}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Edges</div>
        <div style={{ fontWeight: 800 }}>{r.edgeCount ?? "—"}</div>
      </div>
    </div>
  );
}

export function KnowledgePipelineMonitorPanel(p: {
  readonly runs: readonly KnowledgePipelineRunRecord[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
}) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = useMemo(() => {
    if (selectedRunId) {
      const hit = p.runs.find((r) => r.id === selectedRunId);
      if (hit) return hit;
    }
    return p.runs[0] ?? null;
  }, [p.runs, selectedRunId]);

  const items = selectedRun ? buildKnowledgeActivityItems({ pipelineRun: selectedRun }) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: t.textPrimary }}>Knowledge Activity</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
            Graph 생성 파이프라인 실행 이력 (DB 영속)
          </div>
        </div>
        <button
          type="button"
          onClick={p.onRefresh}
          disabled={p.loading}
          style={{
            minHeight: 36,
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            fontSize: 12,
            fontWeight: 800,
            cursor: p.loading ? "wait" : "pointer",
          }}
        >
          {p.loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {p.error ? (
        <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{p.error}</p>
      ) : null}

      {!p.loading && !p.runs.length ? (
        <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
          아직 기록된 파이프라인 실행이 없습니다. 요구사항 저장 후 타임라인이 표시됩니다.
        </p>
      ) : null}

      {selectedRun ? <RunSummary run={selectedRun} /> : null}

      {p.runs.length > 1 ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary, marginBottom: 6 }}>
            최근 실행 ({p.runs.length})
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {p.runs.map((run) => {
              const active = selectedRun?.id === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(run.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${active ? t.primary : t.border}`,
                      background: active ? "#eff6ff" : t.bgPage,
                      fontSize: 12,
                      fontWeight: active ? 800 : 600,
                      cursor: "pointer",
                    }}
                  >
                    {formatRunListLabel(run)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {selectedRun?.errorMessage ? (
        <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>{selectedRun.errorMessage}</p>
      ) : null}

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, index) => (
          <li
            key={item.id}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: item.type === "warning" ? "#fff7ed" : "#f8fafc",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: item.type === "warning" ? "#fdba74" : "#93c5fd",
                color: "#0f172a",
                fontSize: 11,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary }}>{item.title}</div>
              {item.summary ? (
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{item.summary}</div>
              ) : null}
              {item.occurredAt ? (
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                  {new Date(item.occurredAt).toLocaleString("ko-KR")}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
