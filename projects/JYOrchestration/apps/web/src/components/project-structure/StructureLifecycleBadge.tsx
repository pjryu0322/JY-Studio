"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { GraphReflectionStatus } from "@/lib/project-structure/structureReviewUiTypes";
import { graphReflectionStatusLabel } from "@/lib/project-structure/structureReviewViewModel";

const lifecycleStyles: Record<string, { bg: string; color: string; border: string }> = {
  CANDIDATE: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  APPROVED: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  MODIFIED: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  DEPRECATED: { bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
  ARCHIVED: { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  border: "1px solid",
  lineHeight: 1.3,
};

export function StructureLifecycleBadge({ status }: { readonly status: string }) {
  const key = String(status ?? "CANDIDATE").trim().toUpperCase();
  const style = lifecycleStyles[key] ?? lifecycleStyles.CANDIDATE!;
  return (
    <span style={{ ...badgeBase, background: style.bg, color: style.color, borderColor: style.border }}>{key}</span>
  );
}

const reflectionStyles: Record<GraphReflectionStatus, { bg: string; color: string; border: string }> = {
  not_reflected: { bg: "#f8fafc", color: t.textMuted, border: t.border },
  approved_pending_graph: { bg: "#fffbeb", color: t.warning, border: t.borderCaution },
  graph_applied: { bg: "#ecfdf5", color: t.success, border: "#a7f3d0" },
};

export function StructureGraphReflectionBadge({
  status,
}: {
  readonly status: GraphReflectionStatus;
}) {
  const style = reflectionStyles[status];
  return (
    <span style={{ ...badgeBase, background: style.bg, color: style.color, borderColor: style.border }}>
      {graphReflectionStatusLabel(status)}
    </span>
  );
}
