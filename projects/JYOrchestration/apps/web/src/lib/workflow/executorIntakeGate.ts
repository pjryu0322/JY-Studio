/**
 * Lightweight selectors for executor intake contract (pre-execution only).
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { ExecutionAssignmentHandoffPayload } from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import {
  isExecutorIntakeContractForHandoff,
  type ExecutorIntakeContract,
} from "@/lib/workflow/executorIntakeContract";
import { getExecutionHandoffStateForSession } from "@/lib/workflow/executionAssignmentHandoffGate";
import { resolveSessionExecutorIntakeContract } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutorIntakeContract(
  sessionId: string | null | undefined
): ExecutorIntakeContract | undefined {
  return resolveSessionExecutorIntakeContract(sessionId);
}

export function isCurrentExecutorIntakeContract(input: {
  intake: ExecutorIntakeContract | undefined;
  handoff: ExecutionAssignmentHandoffPayload | undefined;
  isEffectivelyHandoffReady: boolean;
}): boolean {
  if (!input.isEffectivelyHandoffReady) return false;
  return isExecutorIntakeContractForHandoff(input.intake, input.handoff);
}

export function getExecutorIntakeStateForSession(
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
} {
  const base = getExecutionHandoffStateForSession(sessionId, ctx);
  const intakeContract = resolveSessionExecutorIntakeContract(sessionId);
  const isEffectivelyIntakeReady = isCurrentExecutorIntakeContract({
    intake: intakeContract,
    handoff: base.handoffPayload,
    isEffectivelyHandoffReady: base.isEffectivelyHandoffReady,
  });
  return { ...base, intakeContract, isEffectivelyIntakeReady };
}
