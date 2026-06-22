"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { groupRelatedNodesForExplorer } from "@/lib/project-graph/projectGraphExploration";
import type { StructureExplainabilityRelatedNode } from "@/lib/project-structure/structureExplainabilityModel";

const BUCKET_LABELS: Record<string, string> = {
  Requirement: "Requirement",
  Feature: "Feature",
  Screen: "Screen",
  Flow: "Flow",
  Review: "Review",
  Task: "Task",
  Other: "Other",
};

export function ProjectGraphRelatedNodeExplorer({
  centerNodeTitle,
  centerNodeType,
  relatedNodes,
  onSelectNodeId,
}: {
  readonly centerNodeTitle: string;
  readonly centerNodeType: string;
  readonly relatedNodes: readonly StructureExplainabilityRelatedNode[];
  readonly onSelectNodeId: (nodeId: string) => void;
}) {
  const grouped = groupRelatedNodesForExplorer(relatedNodes);
  const row: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)",
    gap: 12,
    padding: "10px 12px",
    borderTop: `1px solid ${t.border}`,
    fontSize: 12,
  };

  return (
    <section aria-label="Related node explorer" style={row}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>현재 노드</div>
        <div style={{ fontWeight: 800, color: t.textPrimary }}>{centerNodeTitle}</div>
        <div style={{ color: t.textMuted }}>{centerNodeType}</div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, marginBottom: 6 }}>관련 노드</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
          {(Object.keys(grouped) as (keyof typeof grouped)[]).map((key) => {
            const list = grouped[key];
            if (list.length === 0) return null;
            return (
              <div key={key}>
                <div style={{ fontWeight: 700, color: t.textSecondary, marginBottom: 2 }}>{BUCKET_LABELS[key] ?? key}</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {list.map((r) => (
                    <li key={`${r.nodeId}-${r.edgeType}-${r.direction}`} style={{ marginBottom: 2 }}>
                      <button
                        type="button"
                        onClick={() => onSelectNodeId(r.nodeId)}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          color: t.primary,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        {r.title}
                      </button>
                      <span style={{ color: t.textMuted }}>
                        {" "}
                        · {r.edgeType} {r.direction === "IN" ? "←" : "→"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {relatedNodes.length === 0 ? (
            <p style={{ margin: 0, color: t.textMuted }}>연결된 관련 노드가 없습니다.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
