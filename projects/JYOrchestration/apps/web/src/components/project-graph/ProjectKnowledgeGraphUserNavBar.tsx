"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { ProjectKnowledgeGraphPane } from "@/components/project-graph/projectKnowledgeGraphWorkspaceTypes";
import { knowledgeGraphPaneTitle } from "@/components/project-graph/projectKnowledgeGraphUxMode";

const btnStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
  color: t.primary,
};

export function ProjectKnowledgeGraphUserNavBar(p: {
  readonly pane: Exclude<ProjectKnowledgeGraphPane, "graph">;
  readonly onBack: () => void;
}) {
  return (
    <div
      data-testid="project-knowledge-graph-user-nav"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 0 10px",
        flexShrink: 0,
      }}
    >
      <button type="button" onClick={p.onBack} style={btnStyle} data-testid="project-knowledge-graph-back">
        ← 프로젝트 구조
      </button>
      <span style={{ fontSize: 14, fontWeight: 900, color: t.textPrimary }}>{knowledgeGraphPaneTitle(p.pane)}</span>
    </div>
  );
}
