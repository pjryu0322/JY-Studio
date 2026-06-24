import type { KnowledgePipelineRunStatus } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";

export type KnowledgeRuntimeStatus =
  | "PREPARING"
  | "STRUCTURING"
  | "READY"
  | "NEEDS_REVIEW"
  | "ERROR";

export type KnowledgeRuntimeStatusSummary = Readonly<{
  readonly status: KnowledgeRuntimeStatus;
  readonly statusLabel: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly candidateCount?: number;
  readonly latestChangeTitle?: string | null;
  readonly latestChangedAt?: string | null;
  readonly pipelineStatus?: KnowledgePipelineRunStatus | null;
  readonly warnings?: readonly string[];
}>;
