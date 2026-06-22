"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { StructureExplainabilityPanel } from "@/components/project-structure/StructureExplainabilityPanel";
import { ProjectGraphRelatedNodeExplorer } from "@/components/project-graph/ProjectGraphRelatedNodeExplorer";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import type { GraphImpactZones } from "@/lib/project-graph/projectGraphExploration";

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
    flexShrink: 0,
    borderLeft: `1px solid ${t.border}`,
    padding: 16,
    overflowY: "auto",
    background: t.bgPage,
    minHeight: 0,
  };

  if (!node) {
    return (
      <aside style={panel} aria-label="Graph node detail">
        <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>노드를 선택하면 상세와 Explainability가 표시됩니다.</p>
      </aside>
    );
  }

  const related = node.explainability?.relatedNodes ?? [];

  return (
    <aside style={panel} aria-label="Graph node detail">
      <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: t.textPrimary }}>{node.title}</h2>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>
        <span style={{ fontWeight: 700 }}>{node.nodeType}</span>
        {node.lifecycleStatus ? (
          <>
            {" · "}
            <span>{node.lifecycleStatus}</span>
          </>
        ) : null}
      </div>
      {node.summary ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{node.summary}</p>
      ) : null}

      {impact && (impact.depth1.size > 0 || impact.depth2.size > 0) ? (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            fontSize: 12,
            background: t.surfaceInfoSoft,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>영향 분석 (삭제 시뮬레이션 아님)</div>
          <div>Depth 1: {impact.depth1.size} nodes</div>
          <div>Depth 2: {impact.depth2.size} nodes</div>
        </div>
      ) : null}

      <StructureExplainabilityPanel
        explainability={node.explainability ?? null}
        title="노드 생성 근거"
        onSelectRelatedNodeId={onSelectRelatedNodeId}
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
  if (!node) return null;
  return (
    <ProjectGraphRelatedNodeExplorer
      centerNodeTitle={node.title}
      centerNodeType={node.nodeType}
      relatedNodes={node.explainability?.relatedNodes ?? []}
      onSelectNodeId={onSelectRelatedNodeId}
    />
  );
}
