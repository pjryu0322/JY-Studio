import { createPlatformTrigger } from "@/lib/platform-orchestration/runResultFactory";
import type { PlatformOrchestrationTrigger } from "@/lib/platform-orchestration/types";

export function createFastPlanDraftPlatformTrigger(input: {
  readonly projectId: string;
  readonly userId?: string | null;
  readonly payload?: unknown;
  readonly createdAt?: string;
}): PlatformOrchestrationTrigger {
  return createPlatformTrigger({
    flowId: "fast_plan_draft",
    source: "cta",
    projectId: input.projectId,
    conversationScope: "project_single_chat",
    userId: input.userId ?? null,
    payload: input.payload ?? { action: "request_fast_plan_draft" },
    createdAt: input.createdAt,
  });
}
