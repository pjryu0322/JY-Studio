/**
 * Execution readiness gate: derived evaluation only (NOT Stage1/Stage2, NOT launch).
 * Not persisted — recomputed on read from current session state.
 */

import type { ExecutionRequestLifecycleStatus } from "@/lib/workflow/businessExecutionRequestStore";
import { getExecutorWorkOrderStateForSession } from "@/lib/workflow/executorWorkOrderGate";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export type ExecutionReadinessStatus = "ready" | "not_ready";

export type ExecutionReadiness = {
  readinessId: string;
  workOrderId: string;
  requirementId: string | null;
  sessionId: string;
  status: ExecutionReadinessStatus;
  reasons: string[];
  checkedAtIso: string;
  source: "execution_readiness_gate";
};

function readinessId(): string {
  return `readiness-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type ExecutionReadinessEvaluationInput = {
  sessionId: string;
  requirementId: string | null;
  workOrderId: string;
  hasWorkOrder: boolean;
  isWorkOrderCurrent: boolean;
  hasBusinessRequest: boolean;
  requestValidityStatus: ExecutionRequestLifecycleStatus | null;
  isPackaged: boolean;
  isAssigned: boolean;
  isHandoffCurrent: boolean;
  isIntakeCurrent: boolean;
};

export function evaluateExecutionReadiness(input: ExecutionReadinessEvaluationInput): ExecutionReadiness {
  const reasons: string[] = [];
  const checkedAtIso = new Date().toISOString();

  if (!input.hasWorkOrder || !input.isWorkOrderCurrent) {
    reasons.push("Executor work order is missing or not current.");
  }
  if (!input.hasBusinessRequest) {
    reasons.push("Business execution request missing.");
  } else if (input.requestValidityStatus !== "requested") {
    reasons.push(
      input.requestValidityStatus === "stale"
        ? "Business execution request is stale."
        : "Business execution request is invalid."
    );
  }
  if (!input.isPackaged) {
    reasons.push("Execution package is not current.");
  }
  if (!input.isAssigned) {
    reasons.push("Executor assignment is not current.");
  }
  if (!input.isHandoffCurrent) {
    reasons.push("Assignment handoff is not current.");
  }
  if (!input.isIntakeCurrent) {
    reasons.push("Executor intake is not current.");
  }

  const status: ExecutionReadinessStatus = reasons.length === 0 ? "ready" : "not_ready";

  return {
    readinessId: readinessId(),
    workOrderId: input.workOrderId,
    requirementId: input.requirementId,
    sessionId: input.sessionId,
    status,
    reasons,
    checkedAtIso,
    source: "execution_readiness_gate",
  };
}

export function noSessionExecutionReadiness(): ExecutionReadiness {
  return {
    readinessId: readinessId(),
    workOrderId: "",
    requirementId: null,
    sessionId: "",
    status: "not_ready",
    reasons: ["No session selected."],
    checkedAtIso: new Date().toISOString(),
    source: "execution_readiness_gate",
  };
}

export function resolveExecutionReadinessForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ExecutionReadiness {
  if (!sessionId) {
    return noSessionExecutionReadiness();
  }

  const s = getExecutorWorkOrderStateForSession(sessionId, ctx);
  const workOrderId = s.workOrder?.workOrderId ?? "";
  const requirementId = s.request?.requirementId ?? s.workOrder?.requirementId ?? null;

  return evaluateExecutionReadiness({
    sessionId,
    requirementId,
    workOrderId,
    hasWorkOrder: Boolean(s.workOrder),
    isWorkOrderCurrent: s.isEffectivelyWorkOrderReady,
    hasBusinessRequest: Boolean(s.request),
    requestValidityStatus: s.validity?.status ?? null,
    isPackaged: s.isEffectivelyPackaged,
    isAssigned: s.isEffectivelyAssigned,
    isHandoffCurrent: s.isEffectivelyHandoffReady,
    isIntakeCurrent: s.isEffectivelyIntakeReady,
  });
}

/** Alias matching naming in specs. */
export const resolveExecutionReadiness = resolveExecutionReadinessForSession;

export const EXECUTION_READINESS_UI_REASONS_MAX = 3;
