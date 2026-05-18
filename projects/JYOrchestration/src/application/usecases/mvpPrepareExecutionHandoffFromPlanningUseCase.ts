/**
 * Planning-only use case: run the pipeline and, when READY, produce a
 * {@link import("../planningExecutionHandoff/planningExecutionHandoffTypes").PlanningExecutionHandoffBundle}.
 *
 * Does not call `executionService`, prompts, or HTTP.
 */

import type { PlanningPipelineInput } from "../pipeline/pipelineTypes";
import { runPlanningPipeline } from "../pipeline/mvpPlanningPipeline";
import { buildPlanningExecutionHandoff } from "../planningExecutionHandoff/planningExecutionHandoffBuilder";
import { validatePlanningExecutionHandoffBundle } from "../planningExecutionHandoff/planningExecutionHandoffValidation";
import type { PreparePlanningExecutionHandoffResult } from "../planningExecutionHandoff/planningExecutionHandoffTypes";

export function mvpPrepareExecutionHandoffFromPlanningUseCase(
  input: PlanningPipelineInput
): PreparePlanningExecutionHandoffResult {
  const context = runPlanningPipeline(input);
  const built = buildPlanningExecutionHandoff(context);
  if (!built.ok) {
    return { ok: false, reason: built.reason };
  }
  const v = validatePlanningExecutionHandoffBundle(built.bundle);
  if (!v.ok) {
    return { ok: false, reason: v.reasons.join(" | ") };
  }
  return { ok: true, bundle: built.bundle };
}
