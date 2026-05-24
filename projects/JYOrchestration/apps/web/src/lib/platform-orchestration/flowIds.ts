import type { PlatformFlowId } from "@/lib/platform-orchestration/types";

/** All registered platform flow ids (stable ordering for docs/tests). */
export const PLATFORM_FLOW_IDS: readonly PlatformFlowId[] = [
  "single_chat_turn",
  "slot_action",
  "planning_slots",
  "fast_plan_draft",
  "fast_plan_generation",
  "service_flow",
  "feature_design",
  "deliverable_generation",
  "prototype_generation",
  "execution_runtime",
  "review_security_scm",
] as const;

export function isPlatformFlowId(value: string): value is PlatformFlowId {
  return (PLATFORM_FLOW_IDS as readonly string[]).includes(value);
}
