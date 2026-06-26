"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { ProjectKnowledgeGraphPane } from "@/components/project-graph/projectKnowledgeGraphWorkspaceTypes";
import {
  knowledgeGraphPaneTitle,
  knowledgeGraphTabsUseDiagnosticLabels,
  knowledgeGraphTabsVisible,
  type ProjectKnowledgeGraphUxMode,
} from "@/components/project-graph/projectKnowledgeGraphUxMode";

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
  readonly mode?: ProjectKnowledgeGraphUxMode;
  readonly diagnosticsOpen?: boolean;
}) {
  const mode = props.mode ?? "user";
  const diagnosticsOpen = props.diagnosticsOpen === true;

  if (!knowledgeGraphTabsVisible({ mode, diagnosticsOpen })) {
    return null;
  }

  const english = knowledgeGraphTabsUseDiagnosticLabels(mode);
  const graphLabel = english ? "그래프" : "구조";
  const activityLabel = english ? "Activity" : knowledgeGraphPaneTitle("activity");
  const knowledgeLabel = english ? "Knowledge Activity" : knowledgeGraphPaneTitle("knowledge");

  const tabPane =
    props.activePane === "diagnostic" ? "activity" : props.activePane;

  return (
    <div
      role="tablist"
      aria-label="지식 그래프 보기"
      data-testid="project-knowledge-graph-tabs"
      data-knowledge-graph-tabs-mode={mode}
      style={{ display: "flex", gap: 8, padding: "0 0 10px", flexShrink: 0 }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={tabPane === "graph"}
        data-testid="project-knowledge-graph-tab-graph"
        onClick={() => props.onPaneChange("graph")}
        style={viewTabStyle(tabPane === "graph")}
      >
        {graphLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tabPane === "activity"}
        data-testid="project-knowledge-graph-tab-activity"
        onClick={() => props.onPaneChange("activity")}
        style={viewTabStyle(tabPane === "activity")}
      >
        {activityLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tabPane === "knowledge"}
        data-testid="project-knowledge-graph-tab-knowledge"
        onClick={() => {
          props.onPaneChange("knowledge");
          props.onKnowledgePaneSelect?.();
        }}
        style={viewTabStyle(tabPane === "knowledge")}
      >
        {knowledgeLabel}
      </button>
    </div>
  );
}

export type { ProjectKnowledgeGraphPane };
