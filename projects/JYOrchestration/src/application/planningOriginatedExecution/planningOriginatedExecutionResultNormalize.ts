/**
 * Stable shaping and invariant checks for {@link PlanningOriginatedExecutionResult}.
 *
 * Keeps the facade thin: all outward result objects should pass through
 * {@link normalizePlanningOriginatedExecutionResult} before leaving the use-case layer.
 */

import type { PlanningPipelineResultViewModel } from "../pipeline/planningPipelineResultViewModel";
import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import type {
  PlanningOriginatedExecutionPlanningSummary,
  PlanningOriginatedExecutionPreview,
  PlanningOriginatedExecutionResult,
  PlanningOriginatedReadinessSummary,
} from "./planningOriginatedExecutionContracts";

export function buildReadinessSummaryFromViewModel(
  vm: PlanningPipelineResultViewModel
): PlanningOriginatedReadinessSummary | null {
  if (!vm.readinessSummary) {
    return null;
  }
  return {
    isReady: vm.readinessSummary.isReady,
    blockingIssueCount: vm.readinessSummary.blockingIssueCount,
    confirmRequiredCount: vm.readinessSummary.confirmRequiredCount,
    autoResolvedCount: vm.readinessSummary.autoResolvedCount,
  };
}

/** Planning-only summary (no execution preparation ran). */
export function buildPlanningSummaryFromViewModel(
  vm: PlanningPipelineResultViewModel
): PlanningOriginatedExecutionPlanningSummary {
  return {
    projectId: vm.projectId,
    planningStatus: vm.status,
    readiness: buildReadinessSummaryFromViewModel(vm),
    pipelineErrors: [...vm.errors],
    executedStepCount: vm.executedSteps.length,
    stopHint: vm.legacyEarlyStopReason ?? null,
  };
}

export type BuildPlanningOriginatedExecutionPreviewOptions = Readonly<{
  blockingReason?: string;
  taskCountOverride?: number;
}>;

/**
 * User-flow preview after execution preparation succeeded (no raw bundle exposed).
 * Optional overrides apply only for EXECUTION_STARTED / EXECUTION_START_FAILED shaping.
 */
export function buildPlanningOriginatedExecutionPreview(
  vm: PlanningPipelineResultViewModel,
  bundle: ExecutionPreparationBundle,
  options?: BuildPlanningOriginatedExecutionPreviewOptions
): PlanningOriginatedExecutionPreview {
  const readiness = buildReadinessSummaryFromViewModel(vm);
  const taskCount = options?.taskCountOverride ?? bundle.tasks.length;
  return {
    projectId: bundle.projectId,
    planningStatus: vm.status,
    readiness,
    featureCount: bundle.context.featureCount,
    screenCount: bundle.screens.length,
    taskCount,
    /** Post-preparation path is always past the confirmation gate when this preview exists. */
    requiresConfirmation: false,
    ...(options?.blockingReason !== undefined ? { blockingReason: options.blockingReason } : {}),
    taskIdsOrdered: bundle.tasks.map((t) => t.id),
  };
}

/** True when planning is terminal before execution preparation may run. */
export function planningTerminalBlocksPreparation(planningStatus: PlanningPipelineResultViewModel["status"]): boolean {
  return planningStatus === "BLOCKED" || planningStatus === "NEEDS_CONFIRMATION";
}

/**
 * Validates `ok`/`status` alignment and branch payload shape. Throws on violation (programming error).
 * Safe to call from tests and the facade only; does not mutate.
 */
export function normalizePlanningOriginatedExecutionResult(
  result: PlanningOriginatedExecutionResult
): PlanningOriginatedExecutionResult {
  const { status, ok } = result;

  if (status === "BLOCKED" || status === "NEEDS_CONFIRMATION" || status === "EXECUTION_START_FAILED") {
    if (ok !== false) {
      throw new Error(`PlanningOriginatedExecution invariant: status ${status} requires ok false`);
    }
  } else if (status === "READY_FOR_EXECUTION" || status === "EXECUTION_STARTED") {
    if (ok !== true) {
      throw new Error(`PlanningOriginatedExecution invariant: status ${status} requires ok true`);
    }
  }

  if (status === "BLOCKED" || status === "NEEDS_CONFIRMATION") {
    if (!("planningSummary" in result) || !result.planningSummary) {
      throw new Error(`PlanningOriginatedExecution invariant: ${status} requires planningSummary`);
    }
    if ("preview" in result) {
      throw new Error(`PlanningOriginatedExecution invariant: ${status} must not include preview`);
    }
    if ("runId" in result) {
      throw new Error(`PlanningOriginatedExecution invariant: ${status} must not include runId`);
    }
  }

  if (status === "READY_FOR_EXECUTION" || status === "EXECUTION_STARTED") {
    if (!("preview" in result) || !result.preview) {
      throw new Error(`PlanningOriginatedExecution invariant: ${status} requires preview`);
    }
    if ("planningSummary" in result) {
      throw new Error(`PlanningOriginatedExecution invariant: ${status} must not include planningSummary`);
    }
  }

  if (status === "EXECUTION_START_FAILED") {
    if (!("preview" in result) || !result.preview) {
      throw new Error("PlanningOriginatedExecution invariant: EXECUTION_START_FAILED requires preview");
    }
    if ("planningSummary" in result) {
      throw new Error("PlanningOriginatedExecution invariant: EXECUTION_START_FAILED must not include planningSummary");
    }
    if (!result.preview.blockingReason) {
      throw new Error("PlanningOriginatedExecution invariant: EXECUTION_START_FAILED preview.blockingReason required");
    }
  }

  if (status === "EXECUTION_STARTED") {
    if (!("runId" in result) || typeof result.runId !== "string" || result.runId.length === 0) {
      throw new Error("PlanningOriginatedExecution invariant: EXECUTION_STARTED requires non-empty runId");
    }
  }

  if (status === "READY_FOR_EXECUTION" && "runId" in result) {
    throw new Error("PlanningOriginatedExecution invariant: READY_FOR_EXECUTION must not include runId");
  }

  return result;
}

/** @deprecated Use {@link buildPlanningOriginatedExecutionPreview} (same 2-arg behavior without options). */
export function buildPreviewFromPlanningAndPreparation(
  vm: PlanningPipelineResultViewModel,
  bundle: ExecutionPreparationBundle
): PlanningOriginatedExecutionPreview {
  return buildPlanningOriginatedExecutionPreview(vm, bundle);
}
