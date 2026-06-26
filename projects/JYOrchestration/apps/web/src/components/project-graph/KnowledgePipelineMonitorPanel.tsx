"use client";

import { useMemo, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import type { KnowledgePipelineStepStatus } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";
import { computeKnowledgePipelineOpsDiagnostics } from "@/lib/project-knowledge/projectKnowledgePipelineDiagnostics";

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

function metricValue(value: number | undefined): string {
  return value != null ? String(value) : "—";
}

function PersistenceBadge(p: { readonly mode: KnowledgePipelineRunRecord["persistenceMode"] }) {
  const fallback = p.mode === "MEMORY_FALLBACK";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 800,
        border: `1px solid ${fallback ? "#f59e0b" : t.border}`,
        background: fallback ? "#fffbeb" : "#f8fafc",
        color: fallback ? "#92400e" : t.textPrimary,
      }}
    >
      {fallback ? <span aria-hidden>⚠</span> : null}
      Persistence: {fallback ? "MEMORY FALLBACK" : "DATABASE"}
    </div>
  );
}

function StepStatusBadge(p: { readonly status?: KnowledgePipelineStepStatus }) {
  const status = p.status ?? "SUCCESS";
  const styles: Record<KnowledgePipelineStepStatus, { bg: string; color: string; label: string }> = {
    RUNNING: { bg: "#dbeafe", color: "#1d4ed8", label: "RUNNING" },
    SUCCESS: { bg: "#dcfce7", color: "#15803d", label: "SUCCESS" },
    FAILED: { bg: "#fee2e2", color: "#b91c1c", label: "FAILED" },
  };
  const s = styles[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.4,
        padding: "2px 6px",
        borderRadius: 6,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
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
        <div style={{ fontWeight: 800 }}>{metricValue(r.eventCount)}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Candidate Nodes</div>
        <div style={{ fontWeight: 800 }}>{metricValue(r.candidateNodeCount ?? r.candidateCount)}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Candidate Edges</div>
        <div style={{ fontWeight: 800 }}>{metricValue(r.candidateEdgeCount)}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Graph Nodes</div>
        <div style={{ fontWeight: 800 }}>{metricValue(r.graphNodeCount ?? r.nodeCount)}</div>
      </div>
      <div>
        <div style={{ color: t.textMuted, fontWeight: 700 }}>Graph Edges</div>
        <div style={{ fontWeight: 800 }}>{metricValue(r.graphEdgeCount ?? r.edgeCount)}</div>
      </div>
    </div>
  );
}

function OpsDiagnosticsSection(p: { readonly runs: readonly KnowledgePipelineRunRecord[] }) {
  const d = computeKnowledgePipelineOpsDiagnostics(p.runs, 20);
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: t.textPrimary, marginBottom: 10 }}>운영 진단</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
          fontSize: 12,
        }}
      >
        <div>
          <div style={{ color: t.textMuted, fontWeight: 700 }}>최근 실행 시간</div>
          <div style={{ fontWeight: 800 }}>
            {d.latestRunAt ? new Date(d.latestRunAt).toLocaleString("ko-KR") : "—"}
          </div>
        </div>
        <div>
          <div style={{ color: t.textMuted, fontWeight: 700 }}>평균 실행 시간</div>
          <div style={{ fontWeight: 800 }}>{formatDuration(d.averageDurationMs ?? undefined)}</div>
        </div>
        <div>
          <div style={{ color: t.textMuted, fontWeight: 700 }}>최근 실패 횟수</div>
          <div style={{ fontWeight: 800 }}>{d.recentFailureCount}</div>
        </div>
        <div>
          <div style={{ color: t.textMuted, fontWeight: 700 }}>최근 성공률</div>
          <div style={{ fontWeight: 800 }}>
            {d.successRatePercent != null ? `${d.successRatePercent}%` : "—"}
          </div>
        </div>
        <div>
          <div style={{ color: t.textMuted, fontWeight: 700 }}>Fallback 발생 횟수</div>
          <div style={{ fontWeight: 800 }}>{d.fallbackCount}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>최근 {d.sampleSize}개 Run 기준</div>
    </div>
  );
}

export function KnowledgePipelineMonitorPanel(p: {
  readonly runs: readonly KnowledgePipelineRunRecord[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly traceNodeId?: string | null;
  readonly traceNodeTitle?: string | null;
  readonly onOpenTrace?: (nodeId: string) => void;
  readonly displayMode?: "user" | "diagnostic";
  readonly onShowDiagnostics?: () => void;
}) {
  const displayMode = p.displayMode ?? "diagnostic";
  const userMode = displayMode === "user";
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = useMemo(() => {
    if (selectedRunId) {
      const hit = p.runs.find((r) => r.id === selectedRunId);
      if (hit) return hit;
    }
    return p.runs[0] ?? null;
  }, [p.runs, selectedRunId]);

  const items = selectedRun ? buildKnowledgeActivityItems({ pipelineRun: selectedRun }) : [];
  const stepStatusById = useMemo(() => {
    const map = new Map<string, KnowledgePipelineStepStatus>();
    for (const step of selectedRun?.steps ?? []) {
      map.set(step.id, step.status);
    }
    return map;
  }, [selectedRun]);

  const headerPersistenceMode =
    selectedRun?.persistenceMode ?? p.runs[0]?.persistenceMode ?? "DATABASE";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: t.textPrimary }}>
            {userMode ? "생성 과정" : "Knowledge Activity"}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
            {userMode ? "프로젝트 구조가 만들어진 순서를 요약합니다." : "Graph 생성 파이프라인 실행 이력"}
          </div>
          {!userMode ? (
            <div style={{ marginTop: 8 }}>
              <PersistenceBadge mode={headerPersistenceMode} />
            </div>
          ) : null}
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

      {p.onOpenTrace ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "#f8fafc",
          }}
        >
          <span style={{ fontSize: 12, color: t.textSecondary, flex: 1 }}>
            {p.traceNodeId && p.traceNodeTitle
              ? `“${p.traceNodeTitle}”의 생성 과정을 확인할 수 있습니다.`
              : p.traceNodeId
                ? "선택한 항목의 생성 과정을 확인할 수 있습니다."
                : "그래프에서 항목을 선택하면 생성 과정을 볼 수 있습니다."}
          </span>
          <button
            type="button"
            data-testid="knowledge-activity-open-trace"
            disabled={!p.traceNodeId}
            onClick={() => {
              if (p.traceNodeId) p.onOpenTrace?.(p.traceNodeId);
            }}
            style={{
              minHeight: 36,
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.bgPage,
              fontSize: 12,
              fontWeight: 800,
              cursor: p.traceNodeId ? "pointer" : "not-allowed",
              opacity: p.traceNodeId ? 1 : 0.6,
            }}
          >
            생성 과정 보기
          </button>
        </div>
      ) : null}

      {!p.loading && !p.runs.length ? (
        <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>
          아직 기록된 파이프라인 실행이 없습니다. 요구사항 저장 후 타임라인이 표시됩니다.
        </p>
      ) : null}

      {selectedRun && !userMode ? <RunSummary run={selectedRun} /> : null}

      {!userMode && p.runs.length > 1 ? (
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
        {items.map((item, index) => {
          const stepStatus = stepStatusById.get(item.id);
          const running = stepStatus === "RUNNING";
          return (
            <li
              key={item.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                background: item.type === "warning" ? "#fff7ed" : running ? "#eff6ff" : "#f8fafc",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: item.type === "warning" ? "#fdba74" : running ? "#60a5fa" : "#93c5fd",
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
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary }}>{item.title}</div>
                  {!userMode ? <StepStatusBadge status={stepStatus} /> : null}
                </div>
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
          );
        })}
      </ol>

      {userMode && p.onShowDiagnostics ? (
        <button
          type="button"
          data-testid="knowledge-pipeline-show-diagnostics"
          onClick={p.onShowDiagnostics}
          style={{
            alignSelf: "flex-start",
            minHeight: 36,
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          진단 정보 보기
        </button>
      ) : null}

      {!userMode && p.runs.length ? <OpsDiagnosticsSection runs={p.runs} /> : null}
    </div>
  );
}
