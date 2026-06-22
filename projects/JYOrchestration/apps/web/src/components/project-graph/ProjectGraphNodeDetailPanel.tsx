"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { StructureExplainabilityPanel } from "@/components/project-structure/StructureExplainabilityPanel";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { relatedNodeIds } from "@/lib/project-graph/projectGraphLayout";

export function ProjectGraphNodeDetailPanel({
  node,
  edges,
  nodeTitleById,
}: {
  readonly node: ProjectGraphNodeDto | null;
  readonly edges: readonly { readonly id: string; readonly fromNodeId: string; readonly toNodeId: string; readonly edgeType: string }[];
  readonly nodeTitleById: ReadonlyMap<string, string>;
}) {
  const panel: CSSProperties = {
    width: 360,
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

  const rel = relatedNodeIds(node.id, edges);

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

      {(rel.incoming.length > 0 || rel.outgoing.length > 0) && (
        <div style={{ marginBottom: 12, fontSize: 12 }}>
          {rel.incoming.length > 0 ? (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700, color: t.textMuted }}>Incoming</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {rel.incoming.map((id) => (
                  <li key={id}>{nodeTitleById.get(id) ?? id}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {rel.outgoing.length > 0 ? (
            <div>
              <div style={{ fontWeight: 700, color: t.textMuted }}>Outgoing</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {rel.outgoing.map((id) => (
                  <li key={id}>{nodeTitleById.get(id) ?? id}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <StructureExplainabilityPanel explainability={node.explainability ?? null} title="노드 생성 근거" />
    </aside>
  );
}
