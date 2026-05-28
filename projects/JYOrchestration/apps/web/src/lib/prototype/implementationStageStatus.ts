import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { hasImplementationWorkPlanDraftReady } from "@/lib/prototype/implementationWorkPlanDraft";
import { isPlanningReadyForImplementationExecution } from "@/lib/requirements/implementationTaskList";

export type ImplementationStageStatus =
  | "not_ready"
  | "task_list_ready"
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
  if (
    isPlanningReadyForImplementationExecution({
      implementationSeedV1: state.implementationSeedV1,
      implementationTaskListV1: state.implementationTaskListV1,
    })
  ) {
    return "task_list_ready";
  }
  return "implementation_ready";
}
