"use client";

import { useCallback, useEffect, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { fetchKnowledgeTrace } from "@/lib/project-knowledge/projectKnowledgeTraceClient";
import type { ProjectKnowledgeTraceStep } from "@/lib/project-knowledge/projectKnowledgeTraceTypes";

const TYPE_LABELS: Record<ProjectKnowledgeTraceStep["type"], string> = {
  conversation: "Conversation",
  snapshot: "Snapshot",
  proposal: "AI Proposal",
  event: "Event",
  candidate: "Candidate",
  projection: "Projection",
  "graph-node": "Node",
};

function StepCard(p: { readonly step: ProjectKnowledgeTraceStep; readonly isLast: boolean }) {
  const s = p.step;
  return (
    <div data-testid={`knowledge-trace-step-${s.type}`}>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: `1px solid ${t.border}`,
          background: s.type === "graph-node" ? "#eff6ff" : "#f8fafc",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, letterSpacing: 0.3 }}>
          {TYPE_LABELS[s.type] ?? s.type}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary, marginTop: 4 }}>{s.title}</div>
        {s.summary ? (
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6, lineHeight: 1.45 }}>{s.summary}</div>
        ) : null}
        {s.occurredAt ? (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
            {new Date(s.occurredAt).toLocaleString("ko-KR")}
          </div>
        ) : null}
      </div>
      {!p.isLast ? (
        <div style={{ textAlign: "center", padding: "6px 0", color: t.textMuted, fontSize: 14, fontWeight: 900 }} aria-hidden>
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trace 조회 실패");
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
        노드를 선택하면 생성 계보를 표시합니다.
      </p>
    );
  }

  return (
    <div data-testid="knowledge-trace-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ margin: "0 0 4px", fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
        이 노드는 아래 흐름으로 생성되었습니다.
      </p>
      {loading ? <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>계보 불러오는 중…</p> : null}
      {error ? <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>{error}</p> : null}
      {warnings.length ? (
        <p style={{ margin: 0, fontSize: 11, color: "#b45309" }}>참고: {warnings.join(", ")}</p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {lineage.map((step, index) => (
          <StepCard key={step.id} step={step} isLast={index === lineage.length - 1} />
        ))}
      </div>
      {!loading && !lineage.length && !error ? (
        <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>표시할 계보 단계가 없습니다.</p>
      ) : null}
    </div>
  );
}
