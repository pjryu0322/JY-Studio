/**
 * **Planning-originated execution facade** (application layer only).
 *
 * Orchestrates the existing internal chain without replacing it:
 * `mvpRunPlanningPipelineUseCase` → `mvpPrepareExecutionInputFromPlanningUseCase` (handoff + prep inside)
 * → optional `mvpStartExecutionFromPreparationUseCase` (execution bridge + guarded start).
 *
 * **UI/API:** attach here and consume {@link PlanningOriginatedExecutionResult}; do not wire UI directly to
 * execution bridge seed helpers or raw preparation bundles.
 *
 * This module is **orchestration-only** — not a new execution engine and not a planning rewrite.
 *
 * @param deps Optional `startFromPreparation` override for deterministic tests only.
 */

import type { PlanningPipelineInput } from "../pipeline/pipelineTypes";
import { mvpRunPlanningPipelineUseCase } from "./mvpRunPlanningPipelineUseCase";
import { mvpPrepareExecutionInputFromPlanningUseCase } from "./mvpPrepareExecutionInputFromPlanningUseCase";
import { mvpStartExecutionFromPreparationUseCase } from "./mvpStartExecutionFromPreparationUseCase";
import type {
  PlanningOriginatedExecutionDeps,
  PlanningOriginatedExecutionInput,
  PlanningOriginatedExecutionResult,
} from "../planningOriginatedExecution/planningOriginatedExecutionContracts";
import {
  buildPlanningOriginatedExecutionPreview,
  buildPlanningSummaryFromViewModel,
  normalizePlanningOriginatedExecutionResult,
  planningTerminalBlocksPreparation,
} from "../planningOriginatedExecution/planningOriginatedExecutionResultNormalize";

function toPlanningPipelineInput(input: PlanningOriginatedExecutionInput): PlanningPipelineInput {
  if ("refinement" in input) {
    return { projectId: input.projectId, refinement: input.refinement };
  }
  return { projectId: input.projectId, inputText: input.inputText };
}

export async function mvpRunPlanningOriginatedExecutionUseCase(
  input: PlanningOriginatedExecutionInput,
  deps?: PlanningOriginatedExecutionDeps
): Promise<PlanningOriginatedExecutionResult> {
  const pipelineInput = toPlanningPipelineInput(input);
  const plan = mvpRunPlanningPipelineUseCase(pipelineInput);
  const vm = plan.viewModel;
  const planningSummary = buildPlanningSummaryFromViewModel(vm);

  if (planningTerminalBlocksPreparation(vm.status)) {
    if (vm.status === "BLOCKED") {
      return normalizePlanningOriginatedExecutionResult({
        ok: false,
        status: "BLOCKED",
        reason: vm.legacyEarlyStopReason ?? "BLOCKED",
        planningSummary,
      });
    }
    return normalizePlanningOriginatedExecutionResult({
      ok: false,
      status: "NEEDS_CONFIRMATION",
      reason: vm.legacyEarlyStopReason ?? "NEEDS_CONFIRMATION",
      planningSummary,
    });
  }

  if (vm.status !== "READY") {
    return normalizePlanningOriginatedExecutionResult({
      ok: false,
      status: "BLOCKED",
      reason: "PLANNING_STATUS_NOT_READY",
      planningSummary,
    });
  }

  const prep = mvpPrepareExecutionInputFromPlanningUseCase(pipelineInput);
  if (!prep.ok) {
    return normalizePlanningOriginatedExecutionResult({
      ok: false,
      status: "BLOCKED",
      reason: prep.reason,
      planningSummary,
    });
  }

  const previewBase = buildPlanningOriginatedExecutionPreview(vm, prep.bundle);

  if (input.mode === "PREPARE_ONLY") {
    return normalizePlanningOriginatedExecutionResult({
      ok: true,
      status: "READY_FOR_EXECUTION",
      preview: previewBase,
    });
  }

  const startFn = deps?.startFromPreparation ?? mvpStartExecutionFromPreparationUseCase;
  const started = await startFn(prep.bundle);
  if (!started.ok) {
    return normalizePlanningOriginatedExecutionResult({
      ok: false,
      status: "EXECUTION_START_FAILED",
      reason: started.reason,
      preview: buildPlanningOriginatedExecutionPreview(vm, prep.bundle, {
        blockingReason: started.reason,
      }),
    });
  }

  return normalizePlanningOriginatedExecutionResult({
    ok: true,
    status: "EXECUTION_STARTED",
    runId: started.runId,
    preview: buildPlanningOriginatedExecutionPreview(vm, prep.bundle, {
      taskCountOverride: started.sourceTaskCount ?? previewBase.taskCount,
    }),
  });
}
