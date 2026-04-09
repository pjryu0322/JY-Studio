/**
 * Lightweight selectors for execution assignment (pre-execution only).
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import {
  getBusinessExecutionPackageStateForSession,
} from "@/lib/workflow/businessExecutionPackageGate";
import {
  isExecutionAssignmentForPackage,
  type ExecutionAssignment,
} from "@/lib/workflow/executionAssignment";
import { resolveSessionExecutionAssignment } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveExecutionAssignment(
  sessionId: string | null | undefined
): ExecutionAssignment | undefined {
  return resolveSessionExecutionAssignment(sessionId);
}

export function isCurrentExecutionPackageAssigned(input: {
  assignment: ExecutionAssignment | undefined;
  pkg: BusinessExecutionPackage | undefined;
  isEffectivelyPackaged: boolean;
}): boolean {
  if (!input.isEffectivelyPackaged) return false;
  return isExecutionAssignmentForPackage(input.assignment, input.pkg);
}

export function getExecutionAssignmentStateForSession(
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
} {
  const base = getBusinessExecutionPackageStateForSession(sessionId, ctx);
  const assignment = resolveSessionExecutionAssignment(sessionId);
  const isEffectivelyAssigned = isCurrentExecutionPackageAssigned({
    assignment,
    pkg: base.pkg,
    isEffectivelyPackaged: base.isEffectivelyPackaged,
  });
  return { ...base, assignment, isEffectivelyAssigned };
}
