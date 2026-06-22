"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import {
  STRUCTURE_CONFLICT_GROUP_LABELS,
  type StructureConflictRow,
} from "@/lib/project-structure/structureReviewUiTypes";
import { groupStructureConflicts } from "@/lib/project-structure/structureReviewViewModel";

export function StructureConflictPanel({
  conflicts,
  onSelectCandidate,
}: {
  readonly conflicts: readonly StructureConflictRow[];
  readonly onSelectCandidate: (id: string) => void;
}) {
  if (conflicts.length === 0) {
    return (
      <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>감지된 충돌이 없습니다.</p>
    );
  }

  const grouped = groupStructureConflicts(conflicts);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[...grouped.entries()].map(([kind, items]) => (
        <section key={kind}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary, margin: "0 0 6px" }}>
            {STRUCTURE_CONFLICT_GROUP_LABELS[kind] ?? kind}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((c, idx) => (
              <li
                key={`${kind}-${idx}`}
                style={{
                  fontSize: 12,
                  padding: 8,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: "#fff",
                }}
              >
                <div style={{ color: t.textMuted, marginBottom: 4 }}>{c.message}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {c.candidateIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectCandidate(id)}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: t.bgPage,
                        cursor: "pointer",
                      }}
                    >
                      {id.slice(0, 8)}…
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
