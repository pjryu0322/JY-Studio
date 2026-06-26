"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { AGENT_GRAPH_VIEW_OPTIONS } from "@/lib/project-knowledge/projectKnowledgeAgentGraphViewOptions";
import {
  normalizeProjectKnowledgeGraphView,
  type ProjectKnowledgeGraphView,
} from "@/lib/project-knowledge/projectKnowledgeAgentGraphProjection";

const tabListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};

function tabButtonStyle(active: boolean): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    minHeight: 32,
    borderRadius: 8,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? "#eff6ff" : t.bgPage,
    color: active ? t.primary : t.textSecondary,
    cursor: "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
}

export function ProjectKnowledgeAgentGraphViewTabs(p: {
  readonly value: ProjectKnowledgeGraphView;
  readonly onChange: (view: ProjectKnowledgeGraphView) => void;
}) {
  const active = normalizeProjectKnowledgeGraphView(p.value);

  return (
    <div
      role="tablist"
      aria-label="Agent View"
      data-testid="knowledge-graph-agent-view-tabs"
      style={tabListStyle}
    >
      {AGENT_GRAPH_VIEW_OPTIONS.map((opt) => {
        const selected = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`knowledge-graph-agent-view-${opt.value}`}
            onClick={() => p.onChange(opt.value)}
            style={tabButtonStyle(selected)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
