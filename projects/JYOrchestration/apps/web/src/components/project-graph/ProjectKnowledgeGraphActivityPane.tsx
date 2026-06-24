"use client";

import { ProjectKnowledgeGraphActivityPanel } from "@/components/project-graph/ProjectKnowledgeGraphActivityPanel";
import type { ProjectGraphActivitySummary } from "@/lib/project-graph/projectGraphActivityClient";

export function ProjectKnowledgeGraphActivityPane(p: {
  readonly projectId: string;
  readonly summary: ProjectGraphActivitySummary | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly highlightSourceMessageId: string | null;
  readonly onRefresh: () => void;
}) {
  return (
    <div
      data-testid="project-knowledge-graph-activity-pane"
      style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
    >
      <ProjectKnowledgeGraphActivityPanel
        projectId={p.projectId}
        summary={p.summary}
        loading={p.loading}
        error={p.error}
        highlightSourceMessageId={p.highlightSourceMessageId}
        showTimeline
        onRefresh={p.onRefresh}
      />
    </div>
  );
}
