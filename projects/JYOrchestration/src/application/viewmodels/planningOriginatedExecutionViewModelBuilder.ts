/**
 * Maps {@link import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionResponse}
 * → {@link PlanningOriginatedExecutionViewModel}. **Input must be normalized** (e.g. from
 * {@link import("../contracts/planningOriginatedExecutionResponseBuilder").presentPlanningOriginatedExecutionResult}).
 *
 * Centralizes display-oriented shaping; does not call engines or read bundles.
 */

import type { PlanningOriginatedExecutionResponse } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningOriginatedReadinessSummary } from "../planningOriginatedExecution/planningOriginatedExecutionContracts";
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
import { planningExecutionStatusCopy } from "./planningOriginatedExecutionStatusCopy";

type StatusCardDef = Readonly<{
  tone: PlanningExecutionTone;
  badgeLabel: string;
}>;

const STATUS_CARD: Record<PlanningOriginatedExecutionStatus, StatusCardDef> = {
  BLOCKED: {
    tone: "danger",
    badgeLabel: "차단됨",
  },
  NEEDS_CONFIRMATION: {
    tone: "warning",
    badgeLabel: "확인 필요",
  },
  READY_FOR_EXECUTION: {
    tone: "neutral",
    badgeLabel: "준비됨",
  },
  EXECUTION_STARTED: {
    tone: "success",
    badgeLabel: "시작됨",
  },
  EXECUTION_START_FAILED: {
    tone: "danger",
    badgeLabel: "실패",
  },
};

function statusCardFor(status: PlanningOriginatedExecutionStatus): PlanningExecutionStatusCardViewModel {
  const d = STATUS_CARD[status];
  const copy = planningExecutionStatusCopy(status);
  return {
    status,
    tone: d.tone,
    badgeLabel: d.badgeLabel,
    headline: copy.headline,
    explanation: copy.explanation,
    nextStepGuidance: copy.nextStepGuidance,
  };
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

function confirmationSummaryFromReadiness(
  r: PlanningOriginatedReadinessSummary | null
): import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedConfirmationNeededSummary {
  if (!r) return null;
  if (r.confirmRequiredCount === 0 && r.blockingIssueCount === 0) return null;
  return { confirmRequiredCount: r.confirmRequiredCount, blockingIssueCount: r.blockingIssueCount };
}

function confirmationQualitativeSummary(
  summary: import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedConfirmationNeededSummary
): string | null {
  if (!summary) return null;
  const { confirmRequiredCount, blockingIssueCount } = summary;
  if (confirmRequiredCount > 0 && blockingIssueCount > 0) {
    return "미확정 항목과 차단 이슈가 남아 있어, 확인 후에만 실행을 진행할 수 있습니다.";
  }
  if (confirmRequiredCount > 0) {
    return "몇 가지 미확정 항목이 있어, 확인이 끝나야 실행을 시작할 수 있습니다.";
  }
  if (blockingIssueCount > 0) {
    return "차단 이슈가 남아 있어, 해결/확인 후에만 실행을 진행할 수 있습니다.";
  }
  return null;
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
    const confirmationNeededSummary =
      status === "NEEDS_CONFIRMATION" ? confirmationSummaryFromReadiness(planning.readiness) : null;
    return {
      projectId: planning.projectId,
      responseStatus: status,
      statusCard,
      counts: null,
      confirmationNeededSummary,
      confirmationNeededQualitativeSummary: status === "NEEDS_CONFIRMATION" ? confirmationQualitativeSummary(confirmationNeededSummary) : null,
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
    confirmationNeededQualitativeSummary: null,
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
