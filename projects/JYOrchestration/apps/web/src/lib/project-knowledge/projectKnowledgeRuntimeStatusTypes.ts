import type { KnowledgePipelineRunStatus } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import type { ReferenceEligibilityLevel } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

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
  readonly referenceEligibilityLevel?: ReferenceEligibilityLevel;
  readonly referenceEligibilityLabel?: string;
  /** User-facing hint when reference is partial or blocked (no internal enums). */
  readonly referenceEligibilityHint?: string;
}>;
