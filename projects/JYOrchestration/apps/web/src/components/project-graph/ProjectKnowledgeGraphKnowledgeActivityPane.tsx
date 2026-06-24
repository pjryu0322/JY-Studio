"use client";

import { KnowledgePipelineMonitorPanel } from "@/components/project-graph/KnowledgePipelineMonitorPanel";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";

export function ProjectKnowledgeGraphKnowledgeActivityPane(p: {
  readonly runs: readonly KnowledgePipelineRunRecord[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
}) {
  return (
    <div
      data-testid="project-knowledge-graph-knowledge-activity-pane"
      style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
    >
      <KnowledgePipelineMonitorPanel
        runs={p.runs}
        loading={p.loading}
        error={p.error}
        onRefresh={p.onRefresh}
      />
    </div>
  );
}
