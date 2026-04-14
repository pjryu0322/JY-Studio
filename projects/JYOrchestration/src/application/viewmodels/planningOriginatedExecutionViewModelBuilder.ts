/**
 * Maps {@link import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionResponse}
 * → {@link PlanningOriginatedExecutionViewModel}. **Input must be normalized** (e.g. from
 * {@link import("../contracts/planningOriginatedExecutionResponseBuilder").presentPlanningOriginatedExecutionResult}).
 *
 * Centralizes display-oriented shaping; does not call engines or read bundles.
 */

import type { PlanningOriginatedExecutionResponse } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import type {
  PlanningExecutionActionViewModel,
  PlanningExecutionCountsViewModel,
  PlanningExecutionMessageViewModel,
  PlanningExecutionStatusCardViewModel,
  PlanningExecutionStructuralAction,
  PlanningExecutionTone,
  PlanningOriginatedExecutionViewModel,
} from "./planningOriginatedExecutionViewModel";
import { planningOriginatedExecutionStatePolicy } from "../planningOriginatedExecution/planningOriginatedExecutionStateModel";

type StatusCardDef = Readonly<{
  tone: PlanningExecutionTone;
  badgeLabel: string;
  headline: string;
  nextActionLabel: string;
}>;

const STATUS_CARD: Record<PlanningOriginatedExecutionStatus, StatusCardDef> = {
  BLOCKED: {
    tone: "danger",
    badgeLabel: "Blocked",
    headline: "Planning cannot proceed with this input",
    nextActionLabel: "Revise planning input",
  },
  NEEDS_CONFIRMATION: {
    tone: "warning",
    badgeLabel: "Confirmation needed",
    headline: "Confirm open points before execution can be prepared",
    nextActionLabel: "Review and confirm",
  },
  READY_FOR_EXECUTION: {
    tone: "neutral",
    badgeLabel: "Ready",
    headline: "Execution is prepared and can be started",
    nextActionLabel: "Start execution",
  },
  EXECUTION_STARTED: {
    tone: "success",
    badgeLabel: "Started",
    headline: "Execution run has started",
    nextActionLabel: "View run status",
  },
  EXECUTION_START_FAILED: {
    tone: "danger",
    badgeLabel: "Start failed",
    headline: "Execution preparation succeeded but start failed",
    nextActionLabel: "Retry or inspect failure",
  },
};

function statusCardFor(status: PlanningOriginatedExecutionStatus): PlanningExecutionStatusCardViewModel {
  const d = STATUS_CARD[status];
  return { status, tone: d.tone, badgeLabel: d.badgeLabel, headline: d.headline, nextActionLabel: d.nextActionLabel };
}

export function planningExecutionStructuralActionsForStatus(
  status: PlanningOriginatedExecutionStatus
): PlanningExecutionActionViewModel {
  return actionsFor(status);
}

function actionsFor(status: PlanningOriginatedExecutionStatus): PlanningExecutionActionViewModel {
  const p = planningOriginatedExecutionStatePolicy(status);
  return {
    primaryAction: p.primaryAction,
    secondaryAction: p.secondaryActions[0] ?? null,
    availableActions: [p.primaryAction, ...p.secondaryActions],
  };
}

function countsFromPreview(p: {
  featureCount: number;
  screenCount: number;
  taskCount: number;
  orderedTaskIds: readonly string[];
}): PlanningExecutionCountsViewModel {
  return {
    featureCount: p.featureCount,
    screenCount: p.screenCount,
    taskCount: p.taskCount,
    orderedTaskIds: p.orderedTaskIds,
  };
}

function messageFrom(
  reasonSummary: string,
  internalReasonCode: string | null,
  blockingReason: string | null
): PlanningExecutionMessageViewModel {
  return {
    reasonSummary,
    internalReasonCode,
    blockingReasonSummary: blockingReason,
  };
}

/** Build UI view-model from a normalized planning-originated execution response. */
export function buildPlanningOriginatedExecutionViewModel(
  response: PlanningOriginatedExecutionResponse
): PlanningOriginatedExecutionViewModel {
  const status = response.status;
  const statusCard = statusCardFor(status);
  const actions = actionsFor(status);

  const canStartExecution = status === "READY_FOR_EXECUTION";
  const canRetry = status === "EXECUTION_START_FAILED";
  const canInspect = status === "EXECUTION_START_FAILED" || status === "EXECUTION_STARTED";

  if (status === "BLOCKED" || status === "NEEDS_CONFIRMATION") {
    const planning = response.planning;
    return {
      projectId: planning.projectId,
      responseStatus: status,
      statusCard,
      counts: null,
      confirmationNeededSummary: null,
      runId: null,
      canStartExecution,
      canRetry,
      canInspect,
      actions,
      message: messageFrom(response.reasonSummary, response.internalReasonCode, null),
      planningHints: {
        planningStatus: planning.planningStatus,
        pipelineErrorCount: planning.pipelineErrorCount,
        executedStepCount: planning.executedStepCount,
        stopHint: planning.stopHint,
      },
    };
  }

  const preview = response.preview;
  const runId = status === "EXECUTION_STARTED" ? response.runId : preview.runId;

  return {
    projectId: preview.projectId,
    responseStatus: status,
    statusCard,
    counts: countsFromPreview({
      featureCount: preview.featureCount,
      screenCount: preview.screenCount,
      taskCount: preview.taskCount,
      orderedTaskIds: preview.orderedTaskIds,
    }),
    confirmationNeededSummary: preview.confirmationNeededSummary,
    runId,
    canStartExecution,
    canRetry,
    canInspect,
    actions,
    message: messageFrom(
      response.reasonSummary,
      status === "EXECUTION_START_FAILED" ? response.internalReasonCode : null,
      preview.blockingReason
    ),
    planningHints: null,
  };
}

/** Alias of {@link buildPlanningOriginatedExecutionViewModel}. */
export function toPlanningOriginatedExecutionViewModel(
  response: PlanningOriginatedExecutionResponse
): PlanningOriginatedExecutionViewModel {
  return buildPlanningOriginatedExecutionViewModel(response);
}
