/**
 * Planning → execution **preparation** use-case (adapter + dry-run only).
 *
 * Canonical chain:
 * `PlanningExecutionHandoffBundle` → execution preparation adapter → validation → `PrepareExecutionInputResult`.
 *
 * Does not call `executionService`, `promptService`, run/retry/review, HTTP, or DB.
 */

import type { PlanningPipelineInput } from "../pipeline/pipelineTypes";
import type { PrepareExecutionInputResult } from "../executionPreparation/executionPreparationContracts";
import { buildExecutionPreparationBundle } from "../executionPreparation/buildExecutionPreparationBundle";
import { validateExecutionPreparationBundle } from "../executionPreparation/validateExecutionPreparationBundle";
import { mvpPrepareExecutionHandoffFromPlanningUseCase } from "./mvpPrepareExecutionHandoffFromPlanningUseCase";

export function mvpPrepareExecutionInputFromPlanningUseCase(
  input: PlanningPipelineInput
): PrepareExecutionInputResult {
  const handoff = mvpPrepareExecutionHandoffFromPlanningUseCase(input);
  if (!handoff.ok) {
    return { ok: false, reason: handoff.reason };
  }

  const built = buildExecutionPreparationBundle(handoff.bundle);
  if (!built.ok) {
    return { ok: false, reason: built.reason };
  }

  const v = validateExecutionPreparationBundle(built.bundle);
  if (!v.ok) {
    return { ok: false, reason: v.reasons.join(" | ") };
  }

  return { ok: true, bundle: built.bundle };
}
