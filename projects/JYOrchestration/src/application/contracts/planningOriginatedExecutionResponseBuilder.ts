/**
 * **Planning-originated execution — response shaping (application layer only).**
 *
 * Centralizes mapping from {@link PlanningOriginatedExecutionResult} to
 * {@link PlanningOriginatedExecutionResponse}. Future HTTP route handlers should call
 * {@link presentPlanningOriginatedExecutionResult} (or {@link toPlanningOriginatedExecutionResponse})
 * and serialize that output — not raw use-case objects or bundle types.
 *
 * This module performs **normalization and validation only**; it does not implement engine logic.
 */

import type { PlanningOriginatedExecutionResult } from "../planningOriginatedExecution/planningOriginatedExecutionContracts";
import type { PlanningOriginatedReadinessSummary } from "../planningOriginatedExecution/planningOriginatedExecutionContracts";
import type {
  PlanningOriginatedExecutionPlanningResponseSlice,
  PlanningOriginatedExecutionPreviewResponse,
  PlanningOriginatedExecutionResponse,
  PlanningOriginatedExecutionStatus,
  PlanningOriginatedConfirmationNeededSummary,
} from "./planningOriginatedExecutionResponse";

const REASON_SUMMARY_BY_STATUS: Record<PlanningOriginatedExecutionStatus, string> = {
  BLOCKED: "Planning or execution preparation cannot proceed.",
  NEEDS_CONFIRMATION: "Human confirmation is required before execution can be prepared.",
  READY_FOR_EXECUTION: "Execution is prepared; start when ready.",
  EXECUTION_STARTED: "Execution run has started.",
  EXECUTION_START_FAILED: "Execution preparation succeeded but starting the run failed.",
};

function planningSliceFromSummary(
  s: import("../planningOriginatedExecution/planningOriginatedExecutionContracts").PlanningOriginatedExecutionPlanningSummary
): PlanningOriginatedExecutionPlanningResponseSlice {
  return {
    projectId: s.projectId,
    planningStatus: s.planningStatus ?? null,
    pipelineErrorCount: s.pipelineErrors.length,
    executedStepCount: s.executedStepCount,
    stopHint: s.stopHint,
    readiness: s.readiness,
  };
}

function confirmationNeededSummaryFromReadiness(
  r: PlanningOriginatedReadinessSummary | null
): PlanningOriginatedConfirmationNeededSummary {
  if (!r || (r.confirmRequiredCount === 0 && r.blockingIssueCount === 0)) {
    return null;
  }
  return { confirmRequiredCount: r.confirmRequiredCount, blockingIssueCount: r.blockingIssueCount };
}

function buildPreviewResponse(
  status: PlanningOriginatedExecutionStatus,
  preview: import("../planningOriginatedExecution/planningOriginatedExecutionContracts").PlanningOriginatedExecutionPreview,
  runId: string | null
): PlanningOriginatedExecutionPreviewResponse {
  return {
    projectId: preview.projectId,
    status,
    planningStatus: preview.planningStatus ?? null,
    requiresConfirmation: preview.requiresConfirmation,
    confirmationNeededSummary: confirmationNeededSummaryFromReadiness(preview.readiness),
    featureCount: preview.featureCount,
    screenCount: preview.screenCount,
    taskCount: preview.taskCount,
    blockingReason: preview.blockingReason ?? null,
    orderedTaskIds: preview.taskIdsOrdered,
    summaryLabel: status,
    runId,
  };
}

/** Maps internal facade result → stable outward response (no bundle leakage). */
export function buildPlanningOriginatedExecutionResponse(
  result: PlanningOriginatedExecutionResult
): PlanningOriginatedExecutionResponse {
  const reasonSummary = REASON_SUMMARY_BY_STATUS[result.status];

  switch (result.status) {
    case "BLOCKED":
      return {
        ok: false,
        status: "BLOCKED",
        internalReasonCode: result.reason,
        reasonSummary,
        planning: planningSliceFromSummary(result.planningSummary),
      };
    case "NEEDS_CONFIRMATION":
      return {
        ok: false,
        status: "NEEDS_CONFIRMATION",
        internalReasonCode: result.reason,
        reasonSummary,
        planning: planningSliceFromSummary(result.planningSummary),
      };
    case "READY_FOR_EXECUTION":
      return {
        ok: true,
        status: "READY_FOR_EXECUTION",
        reasonSummary,
        preview: buildPreviewResponse("READY_FOR_EXECUTION", result.preview, null),
      };
    case "EXECUTION_STARTED":
      return {
        ok: true,
        status: "EXECUTION_STARTED",
        runId: result.runId,
        reasonSummary,
        preview: buildPreviewResponse("EXECUTION_STARTED", result.preview, result.runId),
      };
    case "EXECUTION_START_FAILED":
      return {
        ok: false,
        status: "EXECUTION_START_FAILED",
        internalReasonCode: result.reason,
        reasonSummary,
        preview: buildPreviewResponse("EXECUTION_START_FAILED", result.preview, null),
      };
    default:
      throw new Error("PlanningOriginatedExecutionResponseBuilder: unreachable facade branch");
  }
}

const FORBIDDEN_RESPONSE_KEYS = new Set([
  "bundle",
  "handoff",
  "refinement",
  "screens",
  "tasks",
  "context",
  "source",
  "ExecutionPreparationBundle",
]);

/** Validates outward response shape; throws on invariant or forbidden-key leakage (programming error). */
export function normalizePlanningOriginatedExecutionResponse(
  response: PlanningOriginatedExecutionResponse
): PlanningOriginatedExecutionResponse {
  const { status, ok } = response;
  if ((status === "BLOCKED" || status === "NEEDS_CONFIRMATION" || status === "EXECUTION_START_FAILED") && ok !== false) {
    throw new Error(`Response invariant: ${status} requires ok false`);
  }
  if ((status === "READY_FOR_EXECUTION" || status === "EXECUTION_STARTED") && ok !== true) {
    throw new Error(`Response invariant: ${status} requires ok true`);
  }

  if (status === "BLOCKED" || status === "NEEDS_CONFIRMATION") {
    if (!("planning" in response) || "preview" in response) {
      throw new Error(`Response invariant: ${status} requires planning slice without preview`);
    }
  }
  if (status === "READY_FOR_EXECUTION" || status === "EXECUTION_STARTED" || status === "EXECUTION_START_FAILED") {
    if (!("preview" in response) || !response.preview) {
      throw new Error(`Response invariant: ${status} requires preview`);
    }
    assertNoForbiddenKeys(response.preview, "preview");
  }
  if (status === "EXECUTION_STARTED") {
    if (!("runId" in response) || typeof response.runId !== "string" || response.runId.length === 0) {
      throw new Error("Response invariant: EXECUTION_STARTED requires runId");
    }
  }
  if (status !== "EXECUTION_STARTED" && "runId" in response) {
    throw new Error("Response invariant: runId only allowed on EXECUTION_STARTED root");
  }

  if ("planning" in response) {
    assertNoForbiddenKeys(response.planning, "planning");
  }

  return response;
}

function assertNoForbiddenKeys(obj: object, label: string): void {
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_RESPONSE_KEYS.has(k)) {
      throw new Error(`Response leakage guard: forbidden key "${k}" on ${label}`);
    }
  }
}

/**
 * **Preferred attachment point for future HTTP/API:** normalize facade output in one call.
 * Handlers should return the result of this function (or its JSON serialization), not raw facade objects.
 */
export function presentPlanningOriginatedExecutionResult(
  result: PlanningOriginatedExecutionResult
): PlanningOriginatedExecutionResponse {
  return normalizePlanningOriginatedExecutionResponse(buildPlanningOriginatedExecutionResponse(result));
}

/** Alias of {@link presentPlanningOriginatedExecutionResult} for naming preference at call sites. */
export function toPlanningOriginatedExecutionResponse(
  result: PlanningOriginatedExecutionResult
): PlanningOriginatedExecutionResponse {
  return presentPlanningOriginatedExecutionResult(result);
}
