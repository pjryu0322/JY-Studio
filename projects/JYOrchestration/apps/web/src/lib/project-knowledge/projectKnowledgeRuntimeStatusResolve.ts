import type { KnowledgePipelineRunStatus } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import type { KnowledgeRuntimeStatus } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusTypes";

export const KNOWLEDGE_RUNTIME_STATUS_LABELS: Record<KnowledgeRuntimeStatus, string> = {
  PREPARING: "준비 중",
  STRUCTURING: "구조화 중",
  READY: "구조화 완료",
  NEEDS_REVIEW: "확인 필요",
  ERROR: "오류 발생",
};

export type ResolveKnowledgeRuntimeStatusInput = Readonly<{
  readonly nodeCount: number;
  readonly pipelineStatus: KnowledgePipelineRunStatus | null;
  readonly hasPipelineRun: boolean;
  readonly pendingReviewCandidateCount: number;
}>;

/** Priority: ERROR > STRUCTURING > NEEDS_REVIEW > READY > PREPARING */
export function resolveKnowledgeRuntimeStatus(input: ResolveKnowledgeRuntimeStatusInput): KnowledgeRuntimeStatus {
  if (input.pipelineStatus === "FAILED") return "ERROR";
  if (input.pipelineStatus === "RUNNING") return "STRUCTURING";
  if (input.pendingReviewCandidateCount > 0) return "NEEDS_REVIEW";
  if (input.nodeCount >= 1) return "READY";
  return "PREPARING";
}

export function knowledgeRuntimeStatusLabel(status: KnowledgeRuntimeStatus): string {
  return KNOWLEDGE_RUNTIME_STATUS_LABELS[status];
}
