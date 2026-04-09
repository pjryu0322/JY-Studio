/**
 * Lightweight selectors for executor work order (pre-execution only).
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import type { ExecutorIntakeContract } from "@/lib/workflow/executorIntakeContract";
import {
  isExecutorWorkOrderForIntake,
  type ExecutorWorkOrder,
} from "@/lib/workflow/executorWorkOrder";
import { getExecutorIntakeStateForSession } from "@/lib/workflow/executorIntakeGate";
import { resolveSessionExecutorWorkOrder } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutorWorkOrder(sessionId: string | null | undefined): ExecutorWorkOrder | undefined {
  return resolveSessionExecutorWorkOrder(sessionId);
}

export function isCurrentExecutorWorkOrder(input: {
  workOrder: ExecutorWorkOrder | undefined;
  intake: ExecutorIntakeContract | undefined;
  isEffectivelyIntakeReady: boolean;
}): boolean {
  if (!input.isEffectivelyIntakeReady) return false;
  return isExecutorWorkOrderForIntake(input.workOrder, input.intake);
}

export function getExecutorWorkOrderStateForSession(
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
} {
  const base = getExecutorIntakeStateForSession(sessionId, ctx);
  const workOrder = resolveSessionExecutorWorkOrder(sessionId);
  const isEffectivelyWorkOrderReady = isCurrentExecutorWorkOrder({
    workOrder,
    intake: base.intakeContract,
    isEffectivelyIntakeReady: base.isEffectivelyIntakeReady,
  });
  return { ...base, workOrder, isEffectivelyWorkOrderReady };
}
