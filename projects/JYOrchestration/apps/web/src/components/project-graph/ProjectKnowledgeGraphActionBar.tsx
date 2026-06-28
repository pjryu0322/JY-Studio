"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const barStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  padding: "8px 12px",
  borderBottom: `1px solid ${t.border}`,
  alignItems: "center",
  flexShrink: 0,
};

const btnStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "6px 10px",
  minHeight: 36,
  borderRadius: 8,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
};

export function ProjectKnowledgeGraphActionBar(p: {
  readonly onOpenChangeLog?: () => void;
  readonly onRefresh?: () => void;
  readonly onOpenMemorySettings?: () => void;
  readonly onOpenLog?: () => void;
  readonly compact?: boolean;
}) {
  return (
    <div data-testid="knowledge-graph-action-bar" style={barStyle}>
      {p.onOpenChangeLog ? (
        <button
          type="button"
          data-testid="knowledge-open-change-log"
          onClick={p.onOpenChangeLog}
          style={btnStyle}
        >
          변경 내용
        </button>
      ) : null}
      {p.onRefresh ? (
        <button
          type="button"
          data-testid="knowledge-runtime-status-refresh"
          aria-label="지식 그래프 새로고침"
          onClick={p.onRefresh}
          style={btnStyle}
        >
          새로고침
        </button>
      ) : null}
      {p.onOpenMemorySettings ? (
        <button
          type="button"
          data-testid="knowledge-memory-settings-open"
          aria-label="지식 반영 설정"
          onClick={p.onOpenMemorySettings}
          style={btnStyle}
        >
          지식 반영 설정
        </button>
      ) : null}
      {p.onOpenLog ? (
        <button
          type="button"
          data-testid="knowledge-graph-log-open"
          aria-label="로그"
          onClick={p.onOpenLog}
          style={btnStyle}
        >
          로그
        </button>
      ) : null}
    </div>
  );
}
