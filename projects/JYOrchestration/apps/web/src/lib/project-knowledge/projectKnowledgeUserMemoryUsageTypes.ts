import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";

export const USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_EVENT_VERSION =
  "user_project_knowledge_memory_usage_event_v1" as const;

export const USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION =
  "user_project_knowledge_memory_usage_state_v1" as const;

export type UserProjectKnowledgeMemoryUsageSurface = "single_chat" | "codetask_prompt";

export type UserProjectKnowledgeMemoryUsageOutcome =
  | "injected"
  | "skipped_disabled"
  | "skipped_empty"
  | "skipped_agent_disabled"
  | "failed";

export type UserProjectKnowledgeMemoryUsageEventV1 = Readonly<{
  readonly version: typeof USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_EVENT_VERSION;
  readonly id: string;
  readonly at: string;
  readonly projectId: string;
  readonly userIdHash?: string;
  readonly surface: UserProjectKnowledgeMemoryUsageSurface;
  readonly agent: ProjectKnowledgeAgent;
  readonly outcome: UserProjectKnowledgeMemoryUsageOutcome;
  readonly itemCount: number;
  readonly sourceProjectCount: number;
  readonly controlEnabled: boolean;
  readonly agentEnabled: boolean;
  readonly promptSectionHash?: string;
  readonly promptTimelineEntryId?: string;
  readonly codeTaskId?: string;
  readonly runId?: string;
}>;

export type UserProjectKnowledgeMemoryUsageStateV1 = Readonly<{
  readonly version: typeof USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_STATE_VERSION;
  readonly events: readonly UserProjectKnowledgeMemoryUsageEventV1[];
  readonly updatedAt?: string;
}>;

export type UserProjectKnowledgeMemoryUsageSummaryV1 = Readonly<{
  readonly totalEvents: number;
  readonly injectedEvents: number;
  readonly skippedEvents: number;
  readonly byAgent: Readonly<
    Record<
      ProjectKnowledgeAgent,
      {
        readonly injectedCount: number;
        readonly lastUsedAt?: string;
        readonly lastItemCount: number;
      }
    >
  >;
  readonly recentEvents: readonly UserProjectKnowledgeMemoryUsageEventV1[];
}>;

export type UserProjectKnowledgeMemoryUsageApiEventV1 = Readonly<{
  readonly at: string;
  readonly surface: UserProjectKnowledgeMemoryUsageSurface;
  readonly agent: ProjectKnowledgeAgent;
  readonly outcome: UserProjectKnowledgeMemoryUsageOutcome;
  readonly itemCount: number;
  readonly sourceProjectCount: number;
  readonly controlEnabled: boolean;
  readonly agentEnabled: boolean;
}>;

export type UserProjectKnowledgeMemoryUsageApiSummaryV1 = Readonly<{
  readonly totalEvents: number;
  readonly injectedEvents: number;
  readonly skippedEvents: number;
  readonly byAgent: UserProjectKnowledgeMemoryUsageSummaryV1["byAgent"];
  readonly recentEvents: readonly UserProjectKnowledgeMemoryUsageApiEventV1[];
}>;

/** Future effectiveness proxies (not computed in Phase 7): retry reduction, pin/ignore rate, etc. */

export const DEFAULT_USER_PROJECT_KNOWLEDGE_MEMORY_USAGE_MAX_EVENTS = 100;
