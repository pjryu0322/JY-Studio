"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { fetchKnowledgeTrace } from "@/lib/project-knowledge/projectKnowledgeTraceClient";
import type { ProjectKnowledgeTraceStep } from "@/lib/project-knowledge/projectKnowledgeTraceTypes";

export const KNOWLEDGE_TRACE_STEP_TYPE_LABELS: Record<ProjectKnowledgeTraceStep["type"], string> = {
  conversation: "대화에서 시작됨",
  snapshot: "AI가 초기 정리함",
  proposal: "AI가 제안함",
  event: "사용자가 승인함",
  candidate: "구조 후보가 생성됨",
  projection: "그래프에 반영됨",
  "graph-node": "현재 항목",
};

function StepCard(p: {
  readonly step: ProjectKnowledgeTraceStep;
  readonly isLast: boolean;
  readonly compact?: boolean;
}) {
  const s = p.step;
  const label = KNOWLEDGE_TRACE_STEP_TYPE_LABELS[s.type] ?? s.type;
  const summaryStyle: CSSProperties = p.compact
    ? {
        fontSize: 12,
        color: t.textSecondary,
        marginTop: 4,
        lineHeight: 1.4,
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }
    : {
        fontSize: 12,
        color: t.textSecondary,
        marginTop: 6,
        lineHeight: 1.45,
      };

  return (
    <div data-testid={`knowledge-trace-step-${s.type}`}>
      <div
        style={{
          padding: p.compact ? "8px 10px" : "10px 12px",
          borderRadius: 10,
          border: `1px solid ${t.border}`,
          background: s.type === "graph-node" ? "#eff6ff" : "#f8fafc",
        }}
      >
        <div style={{ fontSize: p.compact ? 12 : 13, fontWeight: 800, color: t.textPrimary }}>{label}</div>
        {s.summary ? <div style={summaryStyle}>{s.summary}</div> : null}
        {!p.compact && s.occurredAt ? (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
            {new Date(s.occurredAt).toLocaleString("ko-KR")}
          </div>
        ) : null}
      </div>
      {!p.isLast ? (
        <div
          style={{
            textAlign: "center",
            padding: p.compact ? "4px 0" : "6px 0",
            color: t.textMuted,
            fontSize: 14,
            fontWeight: 900,
          }}
          aria-hidden
        >
          ↓
        </div>
      ) : null}
    </div>
  );
}

export function ProjectKnowledgeTracePanel(p: {
  readonly projectId: string;
  readonly nodeId: string | null;
  readonly active: boolean;
  readonly compact?: boolean;
}) {
  const [lineage, setLineage] = useState<readonly ProjectKnowledgeTraceStep[]>([]);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const nid = String(p.nodeId ?? "").trim();
    const pid = p.projectId.trim();
    if (!nid || !pid) return;
    setError(null);
    setLoading(true);
    try {
      const trace = await fetchKnowledgeTrace(pid, nid);
      setLineage(trace.lineage);
      setWarnings(trace.warnings);
    } catch {
      setError("생성 과정을 불러오지 못했습니다.");
      setLineage([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, [p.nodeId, p.projectId]);

  useEffect(() => {
    if (!p.active || !p.nodeId) return;
    void reload();
  }, [p.active, p.nodeId, reload]);

  if (!p.nodeId) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: t.textMuted }} data-testid="knowledge-trace-empty">
        항목을 선택하면 만들어진 과정을 볼 수 있습니다.
      </p>
    );
  }

  return (
    <div data-testid="knowledge-trace-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
        이 항목이 만들어진 과정입니다.
      </p>
      {loading ? <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>불러오는 중…</p> : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p> : null}
      {warnings.length ? (
        <p style={{ margin: 0, fontSize: 11, color: "#b45309" }}>
          일부 단계 정보를 찾지 못했습니다. 표시된 내용만 참고해 주세요.
        </p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {lineage.map((step, index) => (
          <StepCard key={step.id} step={step} isLast={index === lineage.length - 1} compact={p.compact} />
        ))}
      </div>
      {!loading && !lineage.length && !error ? (
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>표시할 과정이 없습니다.</p>
      ) : null}
    </div>
  );
}
