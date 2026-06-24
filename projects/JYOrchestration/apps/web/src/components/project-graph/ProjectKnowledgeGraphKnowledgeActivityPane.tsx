"use client";

import { KnowledgePipelineMonitorPanel } from "@/components/project-graph/KnowledgePipelineMonitorPanel";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";

export function ProjectKnowledgeGraphKnowledgeActivityPane(p: {
  readonly runs: readonly KnowledgePipelineRunRecord[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly traceNodeId?: string | null;
  readonly traceNodeTitle?: string | null;
  readonly onOpenTrace?: (nodeId: string) => void;
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
        traceNodeId={p.traceNodeId}
        traceNodeTitle={p.traceNodeTitle}
        onOpenTrace={p.onOpenTrace}
      />
    </div>
  );
}
