"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { ProjectKnowledgeGraphCanvas } from "@/components/project-graph/ProjectKnowledgeGraphCanvas";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";

export function ProjectKnowledgeReplayViewer(p: {
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly graphMobileUx?: boolean;
}) {
  const shell: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    overflow: "hidden",
    background: t.bgPage,
  };

  const height = p.graphMobileUx ? 320 : 480;

  return (
    <div data-testid="knowledge-replay-viewer" style={shell}>
      {p.error ? (
        <p style={{ padding: 12, margin: 0, color: "#b91c1c", fontSize: 13 }}>{p.error}</p>
      ) : null}
      {p.loading ? (
        <p style={{ padding: 12, margin: 0, color: t.textMuted, fontSize: 13 }}>해당 시점 그래프 불러오는 중…</p>
      ) : null}
      <div style={{ flex: 1, minHeight: height }}>
        <ProjectKnowledgeGraphCanvas
          nodes={p.nodes}
          edges={p.edges}
          selectedNodeId={null}
          selectedEdgeId={null}
          highlightNodeIds={new Set()}
          impactZones={null}
          onSelectNode={() => {}}
          onOpenNodeDetail={() => {}}
          onSelectEdge={() => {}}
          width={960}
          height={height}
          centerOnNodeRequest={null}
          treeLayoutRootId={null}
          viewResetNonce={0}
        />
      </div>
    </div>
  );
}
