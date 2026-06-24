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

export type KnowledgePipelineStepRecord = Readonly<{
  readonly id: string;
  readonly stage: KnowledgePipelineStage;
  readonly title: string;
  readonly summary?: string;
  readonly occurredAt: string;
  readonly ok: boolean;
  readonly durationMs?: number;
  readonly status?: string;
}>;

export type KnowledgePipelineRunRecord = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly trigger: string;
  readonly status: KnowledgePipelineRunStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly currentStage: KnowledgePipelineStage;
  readonly steps: readonly KnowledgePipelineStepRecord[];
  readonly eventCount?: number;
  readonly candidateCount?: number;
  readonly nodeCount?: number;
  readonly edgeCount?: number;
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
    type: step.ok ? "graph" : "warning",
    title: STAGE_USER_LABELS[step.stage] ?? step.title,
    summary: step.summary ?? step.title,
    occurredAt: step.occurredAt,
    technicalDetail: { stage: step.stage, runId: run.id, durationMs: step.durationMs },
  }));
}

export type PipelineRunMetricsInput = Readonly<{
  eventCount?: number;
  candidateCount?: number;
  nodeCount?: number;
  edgeCount?: number;
}>;
