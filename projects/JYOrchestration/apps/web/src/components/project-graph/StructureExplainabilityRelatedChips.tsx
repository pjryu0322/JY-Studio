"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import type { StructureExplainabilityRelatedNode } from "@/lib/project-structure/structureExplainabilityModel";

const CHIP_MIN_HEIGHT = 44;

export function StructureExplainabilityRelatedChips(p: {
  readonly items: readonly StructureExplainabilityRelatedNode[];
  readonly onSelectNodeId?: (nodeId: string) => void;
  readonly ariaLabel?: string;
}) {
  if (p.items.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>연결된 관련 노드가 없습니다.</p>;
  }

  const seen = new Set<string>();
  const unique = p.items.filter((r) => {
    if (seen.has(r.nodeId)) return false;
    seen.add(r.nodeId);
    return true;
  });

  return (
    <div
      role="list"
      aria-label={p.ariaLabel ?? "관련 노드"}
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
    >
      {unique.map((r) => (
        <button
          key={`${r.nodeId}-${r.edgeType}`}
          type="button"
          role="listitem"
          onClick={() => p.onSelectNodeId?.(r.nodeId)}
          disabled={!p.onSelectNodeId}
          title={r.nodeType ? `${r.title} (${r.nodeType})` : r.title}
          style={{
            minHeight: CHIP_MIN_HEIGHT,
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.bgCard,
            color: t.textPrimary,
            fontSize: 13,
            fontWeight: 700,
            cursor: p.onSelectNodeId ? "pointer" : "default",
            lineHeight: 1.2,
          }}
        >
          {r.title}
        </button>
      ))}
    </div>
  );
}

export function collectExplainabilityRelatedForChips(
  explainability: Readonly<{
    readonly relatedNodes: readonly StructureExplainabilityRelatedNode[];
    readonly relatedArtifacts: Readonly<{
      readonly reviews: readonly StructureExplainabilityRelatedNode[];
      readonly screens: readonly StructureExplainabilityRelatedNode[];
      readonly features: readonly StructureExplainabilityRelatedNode[];
      readonly flows: readonly StructureExplainabilityRelatedNode[];
      readonly tasks: readonly StructureExplainabilityRelatedNode[];
      readonly changeRequests: readonly StructureExplainabilityRelatedNode[];
    }>;
  }>,
): StructureExplainabilityRelatedNode[] {
  const art = explainability.relatedArtifacts;
  return [
    ...explainability.relatedNodes,
    ...art.features,
    ...art.screens,
    ...art.reviews,
    ...art.changeRequests,
    ...art.flows,
    ...art.tasks,
  ];
}
