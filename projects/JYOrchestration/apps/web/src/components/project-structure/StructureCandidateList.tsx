"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { StructureGraphReflectionBadge, StructureLifecycleBadge } from "@/components/project-structure/StructureLifecycleBadge";
import { StructureConfidenceBadge } from "@/components/project-structure/StructureExplainabilitySection";
import type { StructureCandidateRow, StructureConflictRow } from "@/lib/project-structure/structureReviewUiTypes";
import { candidateCanMerge, resolveGraphReflectionStatus } from "@/lib/project-structure/structureReviewViewModel";

const listItemStyle = (active: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: active ? `1px solid ${t.primary}` : `1px solid ${t.border}`,
  background: active ? "#eff6ff" : t.bgCard,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
});

export function StructureCandidateList({
  candidates,
  conflicts,
  selectedId,
  onSelect,
}: {
  readonly candidates: readonly StructureCandidateRow[];
  readonly conflicts: readonly StructureConflictRow[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (candidates.length === 0) {
    return (
      <p style={{ fontSize: 13, color: t.textMuted, margin: 0, padding: 12 }}>
        표시할 후보가 없습니다. 「Event Store 동기화」로 후보를 가져오세요.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {candidates.map((c) => {
        const hasConflict = candidateCanMerge(c.id, conflicts);
        const reflection = resolveGraphReflectionStatus(c);
        return (
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c.id)} style={listItemStyle(selectedId === c.id)}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <StructureLifecycleBadge status={c.lifecycleStatus} />
                <StructureGraphReflectionBadge status={reflection} />
                {hasConflict ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.danger }}>CONFLICT</span>
                ) : null}
                {c.confidenceLabel ? (
                  <StructureConfidenceBadge label={c.confidenceLabel} percent={c.confidence} />
                ) : null}
              </div>
              <strong style={{ fontSize: 13, color: t.textPrimary, lineHeight: 1.35 }}>{c.title}</strong>
              <span style={{ fontSize: 11, color: t.textMuted }}>{c.nodeType}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
