"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { StructureExplainabilityPanel, StructureConfidenceBadge } from "@/components/project-structure/StructureExplainabilityPanel";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import type { GraphImpactZones } from "@/lib/project-graph/projectGraphExploration";

export function ProjectGraphNodeDetailBody({
  node,
  impact,
  onSelectRelatedNodeId,
  compact = false,
}: {
  readonly node: ProjectGraphNodeDto;
  readonly impact: GraphImpactZones | null;
  readonly onSelectRelatedNodeId: (nodeId: string) => void;
  readonly compact?: boolean;
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

      <StructureExplainabilityPanel
        explainability={node.explainability ?? null}
        title="노드 생성 근거"
        onSelectRelatedNodeId={onSelectRelatedNodeId}
        compact={compact}
      />

      {impact && (impact.depth1.size > 0 || impact.depth2.size > 0) ? (
        <details style={{ marginTop: 12, fontSize: 12 }}>
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
  );
}

export function ProjectGraphNodeDetailPanel({
  node,
  impact,
  onSelectRelatedNodeId,
}: {
  readonly node: ProjectGraphNodeDto | null;
  readonly impact: GraphImpactZones | null;
  readonly onSelectRelatedNodeId: (nodeId: string) => void;
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
          노드를 더블클릭하면 생성 근거와 관련 노드를 볼 수 있습니다.
        </p>
      </aside>
    );
  }

  return (
    <aside style={panel} aria-label="그래프 노드 상세">
      <ProjectGraphNodeDetailBody node={node} impact={impact} onSelectRelatedNodeId={onSelectRelatedNodeId} />
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
