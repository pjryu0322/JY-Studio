import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

export const USER_PROJECT_KNOWLEDGE_MEMORY_STALE_STATE_VERSION =
  "user_project_knowledge_memory_stale_state_v1" as const;

export type UserProjectKnowledgeMemoryStaleReason =
  | "ignored"
  | "not_recently_used"
  | "low_relevance"
  | "old_source_project"
  | "manual_review";

export type UserProjectKnowledgeMemoryStaleCandidateV1 = Readonly<{
  readonly actionId: string;
  readonly agent: ProjectKnowledgeAgent;
  readonly title: string;
  readonly promptSummary: string;
  readonly sourceProjectTitle?: string;
  readonly reasons: readonly UserProjectKnowledgeMemoryStaleReason[];
  readonly relevance?: number;
  readonly lastUsedAt?: string;
  readonly ignored: boolean;
  readonly pinned: boolean;
}>;

export type UserProjectKnowledgeMemoryStalePreviewV1 = Readonly<{
  readonly version: typeof USER_PROJECT_KNOWLEDGE_MEMORY_STALE_STATE_VERSION;
  readonly candidateCount: number;
  readonly candidates: readonly UserProjectKnowledgeMemoryStaleCandidateV1[];
}>;
