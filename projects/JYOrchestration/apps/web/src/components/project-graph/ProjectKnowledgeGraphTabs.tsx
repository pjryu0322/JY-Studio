"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { ProjectKnowledgeGraphPane } from "@/components/project-graph/projectKnowledgeGraphWorkspaceTypes";

const viewTabStyle = (active: boolean): CSSProperties => ({
  minHeight: 44,
  minWidth: 88,
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${active ? t.primary : t.border}`,
  background: active ? "#eff6ff" : t.bgPage,
  color: active ? t.primary : t.textSecondary,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});

export function ProjectKnowledgeGraphTabs(props: {
  readonly activePane: ProjectKnowledgeGraphPane;
  readonly onPaneChange: (pane: ProjectKnowledgeGraphPane) => void;
  readonly onKnowledgePaneSelect?: () => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="지식 그래프 보기"
      data-testid="project-knowledge-graph-tabs"
      style={{ display: "flex", gap: 8, padding: "0 0 10px", flexShrink: 0 }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={props.activePane === "graph"}
        data-testid="project-knowledge-graph-tab-graph"
        onClick={() => props.onPaneChange("graph")}
        style={viewTabStyle(props.activePane === "graph")}
      >
        그래프
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={props.activePane === "activity"}
        data-testid="project-knowledge-graph-tab-activity"
        onClick={() => props.onPaneChange("activity")}
        style={viewTabStyle(props.activePane === "activity")}
      >
        Activity
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={props.activePane === "knowledge"}
        data-testid="project-knowledge-graph-tab-knowledge"
        onClick={() => {
          props.onPaneChange("knowledge");
          props.onKnowledgePaneSelect?.();
        }}
        style={viewTabStyle(props.activePane === "knowledge")}
      >
        Knowledge Activity
      </button>
    </div>
  );
}

export type { ProjectKnowledgeGraphPane };
