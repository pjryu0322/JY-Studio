"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { StructureExplainabilityPanel, StructureConfidenceBadge } from "@/components/project-structure/StructureExplainabilityPanel";
import { ProjectKnowledgeTracePanel } from "@/components/project-graph/ProjectKnowledgeTracePanel";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import type { GraphImpactZones } from "@/lib/project-graph/projectGraphExploration";

export type ProjectGraphNodeDetailTab = "details" | "explainability" | "trace";

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  minHeight: 36,
  padding: "6px 8px",
  borderRadius: 8,
  border: `1px solid ${active ? t.primary : t.border}`,
  background: active ? "#eff6ff" : t.bgPage,
  color: active ? t.primary : t.textSecondary,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
});

export function ProjectGraphNodeDetailBody({
  projectId,
  node,
  impact,
  onSelectRelatedNodeId,
  compact = false,
  detailTab,
  onDetailTabChange,
}: {
  readonly projectId: string;
  readonly node: ProjectGraphNodeDto;
  readonly impact: GraphImpactZones | null;
  readonly onSelectRelatedNodeId: (nodeId: string) => void;
  readonly compact?: boolean;
  readonly detailTab: ProjectGraphNodeDetailTab;
  readonly onDetailTabChange: (tab: ProjectGraphNodeDetailTab) => void;
}) {
  return (
    <>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: compact ? 17 : 16, fontWeight: 900, color: t.textPrimary }}>
          {node.title}
        </h2>
        <div style={{ fontSize: 12, color: t.textMuted, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 800 }}>{node.nodeType}</span>
          {node.lifecycleStatus ? <span>{node.lifecycleStatus}</span> : null}
          {node.explainability ? (
            <StructureConfidenceBadge
              label={node.explainability.confidenceLabel}
              percent={node.explainability.confidence}
            />
          ) : null}
        </div>
      </header>

      <div
        role="tablist"
        aria-label="노드 상세 탭"
        data-testid="project-graph-node-detail-tabs"
        style={{ display: "flex", gap: 6, marginBottom: 12 }}
      >
        <button type="button" role="tab" aria-selected={detailTab === "details"} style={tabBtn(detailTab === "details")} onClick={() => onDetailTabChange("details")}>
          Details
        </button>
        <button type="button" role="tab" aria-selected={detailTab === "explainability"} style={tabBtn(detailTab === "explainability")} onClick={() => onDetailTabChange("explainability")}>
          Explainability
        </button>
        <button type="button" role="tab" aria-selected={detailTab === "trace"} style={tabBtn(detailTab === "trace")} onClick={() => onDetailTabChange("trace")}>
          Trace
        </button>
      </div>

      {detailTab === "details" ? (
        <>
          {node.summary ? (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{node.summary}</p>
          ) : null}
          {impact && (impact.depth1.size > 0 || impact.depth2.size > 0) ? (
            <details style={{ marginTop: 4, fontSize: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800, minHeight: 44, display: "flex", alignItems: "center" }}>
                영향 분석 (고급)
              </summary>
              <div style={{ paddingTop: 8, color: t.textSecondary }}>
                <div>Depth 1: {impact.depth1.size} nodes</div>
                <div>Depth 2: {impact.depth2.size} nodes</div>
              </div>
            </details>
          ) : null}
        </>
      ) : null}

      {detailTab === "explainability" ? (
        <StructureExplainabilityPanel
          explainability={node.explainability ?? null}
          title="노드 생성 근거"
          onSelectRelatedNodeId={onSelectRelatedNodeId}
          compact={compact}
        />
      ) : null}

      {detailTab === "trace" ? (
        <ProjectKnowledgeTracePanel projectId={projectId} nodeId={node.id} active={detailTab === "trace"} compact={compact} />
      ) : null}
    </>
  );
}

export function ProjectGraphNodeDetailPanel({
  projectId,
  node,
  impact,
  onSelectRelatedNodeId,
  detailTab,
  onDetailTabChange,
}: {
  readonly projectId: string;
  readonly node: ProjectGraphNodeDto | null;
  readonly impact: GraphImpactZones | null;
  readonly onSelectRelatedNodeId: (nodeId: string) => void;
  readonly detailTab: ProjectGraphNodeDetailTab;
  readonly onDetailTabChange: (tab: ProjectGraphNodeDetailTab) => void;
}) {
  const panel: CSSProperties = {
    width: 380,
    maxWidth: "100%",
    flex: "4 1 0%",
    flexShrink: 0,
    borderLeft: `1px solid ${t.border}`,
    padding: 16,
    overflowY: "auto",
    background: t.bgPage,
    minHeight: 0,
  };

  if (!node) {
    return (
      <aside style={panel} aria-label="그래프 노드 상세">
        <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
          노드를 더블클릭하면 생성 근거와 Trace 계보를 볼 수 있습니다.
        </p>
      </aside>
    );
  }

  return (
    <aside style={panel} aria-label="그래프 노드 상세">
      <ProjectGraphNodeDetailBody
        projectId={projectId}
        node={node}
        impact={impact}
        onSelectRelatedNodeId={onSelectRelatedNodeId}
        detailTab={detailTab}
        onDetailTabChange={onDetailTabChange}
      />
    </aside>
  );
}

export function ProjectGraphRelatedExplorerStrip({
  node,
  onSelectRelatedNodeId,
}: {
  readonly node: ProjectGraphNodeDto | null;
  readonly onSelectRelatedNodeId: (nodeId: string) => void;
}) {
  return null;
}
