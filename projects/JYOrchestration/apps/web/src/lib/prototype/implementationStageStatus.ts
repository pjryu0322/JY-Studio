import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { hasImplementationWorkPlanDraftReady } from "@/lib/prototype/implementationWorkPlanDraft";

export type ImplementationStageStatus =
  | "not_ready"
  | "implementation_ready"
  | "work_plan_drafted"
  | "work_plan_confirmed"
  | "mock_mode_confirmed"
  | "wip_ready"
  | "wip_requested"
  | "wip_completed"
  | "review_ready"
  | "scm_ready";

export function deriveImplementationStageStatus(
  state: EffectiveImplementationState,
): ImplementationStageStatus {
  const seed = state.implementationSeedV1;
  if (!state.envOk || !seed || seed.lifecycleStatus === "candidate" || !seed.readiness?.ready) {
    return "not_ready";
  }
  if (state.implementationTaskPlanV1) {
    return "work_plan_confirmed";
  }
  if (hasImplementationWorkPlanDraftReady(state.implementationWorkPlanDraftV1)) {
    return "work_plan_drafted";
  }
  return "implementation_ready";
}
