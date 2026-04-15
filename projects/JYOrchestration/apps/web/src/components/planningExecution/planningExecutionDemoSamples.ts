/**
 * **Demo / mock fixtures** for planning-originated execution UI.
 *
 * Shapes match {@link import("@jy-orch/application/public").PlanningOriginatedExecutionResponse}
 * (normalized). No handoff, preparation bundle, bridge input, or seed payload — only the public response contract.
 */

import type {
  PlanningExecutionScreenViewModel,
  PlanningOriginatedExecutionResponse,
  PlanningOriginatedExecutionStatus,
} from "@jy-orch/application/public";
import {
  buildPlanningExecutionScreenViewModel,
  buildPlanningOriginatedExecutionViewModel,
  normalizePlanningOriginatedExecutionResponse,
} from "@jy-orch/application/public";

const DEMO_PREVIEW_BASE = {
  projectId: "demo-project",
  planningStatus: "READY" as const,
  requiresConfirmation: false,
  confirmationNeededSummary: null,
  featureCount: 2,
  screenCount: 3,
  taskCount: 5,
  blockingReason: null as string | null,
  orderedTaskIds: ["task-a", "task-b", "task-c", "task-d", "task-e"] as const,
  summaryLabel: "",
  runId: null as string | null,
};

function previewFor(status: PlanningOriginatedExecutionStatus) {
  return {
    ...DEMO_PREVIEW_BASE,
    status,
    summaryLabel: status,
    runId: status === "EXECUTION_STARTED" ? "demo-run-1" : null,
    blockingReason: status === "EXECUTION_START_FAILED" ? "DEMO_START_FAILED" : null,
  };
}

const demoResponses: Record<PlanningOriginatedExecutionStatus, PlanningOriginatedExecutionResponse> = {
  BLOCKED: {
    ok: false,
    status: "BLOCKED",
    internalReasonCode: "DEMO_BLOCKED",
    reasonSummary: "Planning or execution preparation cannot proceed.",
    planning: {
      projectId: DEMO_PREVIEW_BASE.projectId,
      planningStatus: "BLOCKED",
      pipelineErrorCount: 0,
      executedStepCount: 1,
      stopHint: "DEMO_STOP",
      readiness: null,
    },
  },
  NEEDS_CONFIRMATION: {
    ok: false,
    status: "NEEDS_CONFIRMATION",
    internalReasonCode: "DEMO_NEEDS_CONFIRMATION",
    reasonSummary: "Human confirmation is required before execution can be prepared.",
    planning: {
      projectId: DEMO_PREVIEW_BASE.projectId,
      planningStatus: "NEEDS_CONFIRMATION",
      pipelineErrorCount: 0,
      executedStepCount: 2,
      stopHint: null,
      readiness: {
        isReady: false,
        blockingIssueCount: 1,
        confirmRequiredCount: 2,
        autoResolvedCount: 0,
      },
    },
  },
  READY_FOR_EXECUTION: {
    ok: true,
    status: "READY_FOR_EXECUTION",
    reasonSummary: "실행이 준비되었습니다. 준비되면 시작하세요.",
    preview: previewFor("READY_FOR_EXECUTION"),
  },
  EXECUTION_STARTED: {
    ok: true,
    status: "EXECUTION_STARTED",
    runId: "demo-run-1",
    reasonSummary: "실행 런이 시작되었습니다.",
    preview: { ...previewFor("EXECUTION_STARTED"), runId: "demo-run-1" },
  },
  EXECUTION_START_FAILED: {
    ok: false,
    status: "EXECUTION_START_FAILED",
    internalReasonCode: "DEMO_START_FAILED",
    reasonSummary: "실행 준비는 성공했으나 런 시작에 실패했습니다.",
    preview: { ...previewFor("EXECUTION_START_FAILED"), blockingReason: "DEMO_START_FAILED" },
  },
};

/** Normalized response fixture for a status (throws if contract invalid). */
export function demoPlanningOriginatedExecutionResponse(
  status: PlanningOriginatedExecutionStatus
): PlanningOriginatedExecutionResponse {
  return normalizePlanningOriginatedExecutionResponse(demoResponses[status]);
}

/** Full screen view-model for UI demos and structural tests. */
export function demoPlanningExecutionScreenViewModel(
  status: PlanningOriginatedExecutionStatus
): PlanningExecutionScreenViewModel {
  const response = demoPlanningOriginatedExecutionResponse(status);
  const vm = buildPlanningOriginatedExecutionViewModel(response);
  return buildPlanningExecutionScreenViewModel(vm);
}
