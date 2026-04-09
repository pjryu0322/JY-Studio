/**
 * Lightweight selectors for business launch intent (pre-execution only).
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import type { ExecutorIntakeContract } from "@/lib/workflow/executorIntakeContract";
import type { ExecutorWorkOrder } from "@/lib/workflow/executorWorkOrder";
import {
  evaluateExecutionReadiness,
  noSessionExecutionReadiness,
  type ExecutionReadiness,
} from "@/lib/workflow/executionReadiness";
import {
  isBusinessLaunchIntentCurrent,
  type BusinessLaunchIntent,
} from "@/lib/workflow/businessLaunchIntent";
import { getExecutorWorkOrderStateForSession } from "@/lib/workflow/executorWorkOrderGate";
import { resolveSessionBusinessLaunchIntent } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveBusinessLaunchIntent(
  sessionId: string | null | undefined
): BusinessLaunchIntent | undefined {
  return resolveSessionBusinessLaunchIntent(sessionId);
}

export { isBusinessLaunchIntentCurrent as isCurrentBusinessLaunchIntent };

export function getBusinessLaunchIntentStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): {
  pkg: BusinessExecutionPackage | undefined;
  request: BusinessExecutionRequest | undefined;
  approval: BusinessExecutionApproval | undefined;
  validity: ExecutionRequestValidityResult | null;
  isEffectivelyApproved: boolean;
  isEffectivelyPackaged: boolean;
  assignment: ExecutionAssignment | undefined;
  isEffectivelyAssigned: boolean;
  handoffPayload: ExecutionAssignmentHandoffPayload | undefined;
  isEffectivelyHandoffReady: boolean;
  intakeContract: ExecutorIntakeContract | undefined;
  isEffectivelyIntakeReady: boolean;
  workOrder: ExecutorWorkOrder | undefined;
  isEffectivelyWorkOrderReady: boolean;
  executionReadiness: ExecutionReadiness;
  businessLaunchIntent: BusinessLaunchIntent | undefined;
  isBusinessLaunchIntentCurrent: boolean;
} {
  const base = getExecutorWorkOrderStateForSession(sessionId, ctx);
  const executionReadiness = sessionId
    ? evaluateExecutionReadiness({
        sessionId,
        requirementId: base.request?.requirementId ?? base.workOrder?.requirementId ?? null,
        workOrderId: base.workOrder?.workOrderId ?? "",
        hasWorkOrder: Boolean(base.workOrder),
        isWorkOrderCurrent: base.isEffectivelyWorkOrderReady,
        hasBusinessRequest: Boolean(base.request),
        requestValidityStatus: base.validity?.status ?? null,
        isPackaged: base.isEffectivelyPackaged,
        isAssigned: base.isEffectivelyAssigned,
        isHandoffCurrent: base.isEffectivelyHandoffReady,
        isIntakeCurrent: base.isEffectivelyIntakeReady,
      })
    : noSessionExecutionReadiness();
  const businessLaunchIntent = resolveSessionBusinessLaunchIntent(sessionId);
  const isIntentCurrent = isBusinessLaunchIntentCurrent({
    intent: businessLaunchIntent,
    readiness: executionReadiness,
    workOrder: base.workOrder,
    sessionId,
  });
  return {
    ...base,
    executionReadiness,
    businessLaunchIntent,
    isBusinessLaunchIntentCurrent: isIntentCurrent,
  };
}
