"use client";

import { uiTokens as t } from "@/components/ui/tokens";

const fabBtn = {
  minWidth: 44,
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${t.border}`,
  background: t.bgCard,
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.15)",
  fontSize: 11,
  fontWeight: 800,
  color: t.textPrimary,
  cursor: "pointer",
} as const;

export function ProjectKnowledgeGraphMobileFab(p: {
  readonly onShowAll: () => void;
  readonly onFocusNode: () => void;
  readonly onRefresh: () => void;
  readonly focusDisabled: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label="그래프 빠른 작업"
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        zIndex: 17,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
      }}
    >
      <button type="button" style={fabBtn} onClick={p.onRefresh} aria-label="그래프 새로고침">
        새로고침
      </button>
      <button
        type="button"
        style={fabBtn}
        onClick={p.onFocusNode}
        disabled={p.focusDisabled}
        aria-label="현재 노드 포커스"
      >
        Focus
      </button>
      <button type="button" style={fabBtn} onClick={p.onShowAll} aria-label="전체 그래프 보기">
        전체 보기
      </button>
    </div>
  );
}
