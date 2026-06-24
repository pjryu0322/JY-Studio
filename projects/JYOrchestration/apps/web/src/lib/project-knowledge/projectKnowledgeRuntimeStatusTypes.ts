/**
 * Phase 5.10 — Knowledge Runtime "구조화 상태" summary (design only; UI not wired yet).
 */
export type KnowledgeRuntimeStructureStatus =
  | "preparing"
  | "structuring"
  | "ready"
  | "needs_review";

export type KnowledgeRuntimeStatusSummary = Readonly<{
  readonly status: KnowledgeRuntimeStructureStatus;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly latestChangeTitle?: string | null;
  readonly lastAppliedAt?: string | null;
}>;
