"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { formatKnowledgeRevisionTimeOnly } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import type { KnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

const barStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "6px 10px",
  padding: "8px 12px",
  borderBottom: `1px solid ${t.border}`,
  fontSize: 12,
  lineHeight: 1.45,
  color: t.textSecondary,
  flexShrink: 0,
};

function userStatusShort(summary: KnowledgeRuntimeStatusSummary): string {
  if (summary.status === "READY") return "정리됨";
  if (summary.status === "NEEDS_REVIEW") return "정리 필요";
  return summary.statusLabel?.trim() || "준비 중";
}

export function ProjectKnowledgeGraphSummaryBar(p: {
  readonly summary: KnowledgeRuntimeStatusSummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly displayNodeCount?: number;
  readonly displayEdgeCount?: number;
  readonly viewLabel?: string;
}) {
  if (p.loading) {
    return (
      <div data-testid="knowledge-graph-summary-bar" style={barStyle} aria-live="polite">
        <span style={{ color: t.textMuted }}>상태 불러오는 중…</span>
      </div>
    );
  }

  if (p.error) {
    return (
      <div data-testid="knowledge-graph-summary-bar" style={barStyle} role="alert">
        <span style={{ color: "#b91c1c" }}>구조 상태를 불러오지 못했습니다.</span>
      </div>
    );
  }

  if (!p.summary || (p.summary.status === "PREPARING" && p.summary.nodeCount === 0)) {
    const countLabel = p.viewLabel ?? "현재 보기";
    if (p.displayNodeCount !== undefined && p.displayEdgeCount !== undefined) {
      return (
        <div data-testid="knowledge-graph-summary-bar" style={barStyle}>
          <span>
            <strong style={{ color: t.textPrimary, fontWeight: 800 }}>상태:</strong> 준비 중 · {countLabel}{" "}
            {p.displayNodeCount} nodes · {p.displayEdgeCount} edges
          </span>
        </div>
      );
    }
    return (
      <div data-testid="knowledge-graph-summary-bar" style={barStyle}>
        <span>
          <strong style={{ color: t.textPrimary, fontWeight: 800 }}>상태:</strong> 준비 중 · 항목 없음
        </span>
      </div>
    );
  }

  const nodeCount = p.displayNodeCount ?? p.summary.nodeCount;
  const edgeCount = p.displayEdgeCount ?? p.summary.edgeCount;
  const countLabel = p.viewLabel ?? "현재 보기";
  const lastApplied = p.summary.latestChangedAt
    ? formatKnowledgeRevisionTimeOnly(p.summary.latestChangedAt)
    : null;
  const status = userStatusShort(p.summary);

  return (
    <div data-testid="knowledge-graph-summary-bar" style={barStyle} aria-live="polite">
      <span>
        <strong style={{ color: t.textPrimary, fontWeight: 800 }}>상태:</strong> {status}
        {" · "}
        {countLabel} {nodeCount} nodes · {edgeCount} edges
        {lastApplied ? ` · 최근 반영 ${lastApplied}` : ""}
      </span>
    </div>
  );
}
