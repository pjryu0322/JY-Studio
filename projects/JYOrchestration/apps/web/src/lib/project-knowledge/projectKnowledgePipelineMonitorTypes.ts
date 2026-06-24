import type { ProjectKnowledgeActivityItem } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

export type KnowledgePipelineStage =
  | "EVENT_SYNC"
  | "ARTIFACT_INTEGRATION"
  | "CANDIDATE_EXTRACTION"
  | "GRAPH_PROJECTION"
  | "ACTIVITY_BUILD"
  | "COMPLETED"
  | "FAILED";

export type KnowledgePipelineRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type KnowledgePipelineStepStatus = "RUNNING" | "SUCCESS" | "FAILED";
export type KnowledgePipelinePersistenceMode = "DATABASE" | "MEMORY_FALLBACK";

export type KnowledgePipelineStepRecord = Readonly<{
  readonly id: string;
  readonly stage: KnowledgePipelineStage;
  readonly title: string;
  readonly summary?: string;
  readonly startedAt: string;
  readonly occurredAt: string;
  readonly ok: boolean;
  readonly durationMs?: number;
  readonly status: KnowledgePipelineStepStatus;
}>;

export type KnowledgePipelineRunRecord = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly trigger: string;
  readonly status: KnowledgePipelineRunStatus;
  readonly persistenceMode: KnowledgePipelinePersistenceMode;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly currentStage: KnowledgePipelineStage;
  readonly steps: readonly KnowledgePipelineStepRecord[];
  readonly eventCount?: number;
  /** @deprecated use candidateNodeCount */
  readonly candidateCount?: number;
  /** @deprecated use graphNodeCount */
  readonly nodeCount?: number;
  /** @deprecated use graphEdgeCount */
  readonly edgeCount?: number;
  readonly candidateNodeCount?: number;
  readonly candidateEdgeCount?: number;
  readonly graphNodeCount?: number;
  readonly graphEdgeCount?: number;
  readonly errorMessage?: string;
}>;

export const STAGE_USER_LABELS: Record<KnowledgePipelineStage, string> = {
  EVENT_SYNC: "Conversation Saved",
  ARTIFACT_INTEGRATION: "Snapshot / Proposal Integrated",
  CANDIDATE_EXTRACTION: "Candidate Generated",
  GRAPH_PROJECTION: "Graph Synced",
  ACTIVITY_BUILD: "Activity Built",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function pipelineStepsToActivityItems(run: KnowledgePipelineRunRecord): ProjectKnowledgeActivityItem[] {
  return run.steps.map((step) => ({
    id: step.id,
    type: step.status === "FAILED" || (!step.ok && step.status !== "RUNNING") ? "warning" : "graph",
    title: STAGE_USER_LABELS[step.stage] ?? step.title,
    summary: step.summary ?? step.title,
    occurredAt: step.occurredAt,
    technicalDetail: {
      stage: step.stage,
      runId: run.id,
      durationMs: step.durationMs,
      stepStatus: step.status,
    },
  }));
}

export type PipelineRunMetricsInput = Readonly<{
  eventCount?: number;
  /** @deprecated */
  candidateCount?: number;
  /** @deprecated */
  nodeCount?: number;
  /** @deprecated */
  edgeCount?: number;
  candidateNodeCount?: number;
  candidateEdgeCount?: number;
  graphNodeCount?: number;
  graphEdgeCount?: number;
}>;

export function normalizePipelineRunMetrics(
  metrics?: PipelineRunMetricsInput,
): PipelineRunMetricsInput | undefined {
  if (!metrics) return undefined;
  const candidateNodeCount = metrics.candidateNodeCount ?? metrics.candidateCount ?? metrics.nodeCount;
  const candidateEdgeCount = metrics.candidateEdgeCount ?? metrics.edgeCount;
  const graphNodeCount = metrics.graphNodeCount ?? metrics.nodeCount;
  const graphEdgeCount = metrics.graphEdgeCount ?? metrics.edgeCount;
  return {
    ...metrics,
    candidateNodeCount,
    candidateEdgeCount,
    graphNodeCount,
    graphEdgeCount,
    candidateCount: metrics.candidateCount ?? candidateNodeCount,
    nodeCount: metrics.nodeCount ?? graphNodeCount,
    edgeCount: metrics.edgeCount ?? graphEdgeCount,
  };
}
