/**
 * Lightweight selectors for execution assignment handoff payload (pre-execution only).
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import {
  isExecutionAssignmentHandoffPayloadForAssignment,
  type ExecutionAssignmentHandoffPayload,
} from "@/lib/workflow/executionAssignmentHandoffPayload";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import { getExecutionAssignmentStateForSession } from "@/lib/workflow/executionAssignmentGate";
import { resolveSessionExecutionAssignmentHandoffPayload } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutionAssignmentHandoff(
  sessionId: string | null | undefined
): ExecutionAssignmentHandoffPayload | undefined {
  return resolveSessionExecutionAssignmentHandoffPayload(sessionId);
}

export function isCurrentExecutionAssignmentHandoff(input: {
  handoff: ExecutionAssignmentHandoffPayload | undefined;
  assignment: ExecutionAssignment | undefined;
  pkg: BusinessExecutionPackage | undefined;
  isEffectivelyAssigned: boolean;
}): boolean {
  if (!input.isEffectivelyAssigned) return false;
  return isExecutionAssignmentHandoffPayloadForAssignment(input.handoff, input.assignment, input.pkg);
}

export function getExecutionHandoffStateForSession(
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
} {
  const base = getExecutionAssignmentStateForSession(sessionId, ctx);
  const handoffPayload = resolveSessionExecutionAssignmentHandoffPayload(sessionId);
  const isEffectivelyHandoffReady = isCurrentExecutionAssignmentHandoff({
    handoff: handoffPayload,
    assignment: base.assignment,
    pkg: base.pkg,
    isEffectivelyAssigned: base.isEffectivelyAssigned,
  });
  return { ...base, handoffPayload, isEffectivelyHandoffReady };
}
