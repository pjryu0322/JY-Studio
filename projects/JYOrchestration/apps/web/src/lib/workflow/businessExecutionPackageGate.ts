/**
 * Lightweight selectors for business execution package (pre-execution only).
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import {
  isBusinessPackageForApprovedRequest,
  type BusinessExecutionPackage,
} from "@/lib/workflow/businessExecutionPackage";
import { getBusinessExecutionApprovalStateForSession } from "@/lib/workflow/businessExecutionGate";
import { resolveSessionBusinessExecutionPackage } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveBusinessExecutionPackage(
  sessionId: string | null | undefined
): BusinessExecutionPackage | undefined {
  return resolveSessionBusinessExecutionPackage(sessionId);
}

export function isCurrentBusinessExecutionPackage(input: {
  pkg: BusinessExecutionPackage | undefined;
  request: BusinessExecutionRequest | undefined;
  approval: BusinessExecutionApproval | undefined;
  isEffectivelyApproved: boolean;
}): boolean {
  if (!input.isEffectivelyApproved) return false;
  return isBusinessPackageForApprovedRequest(input.pkg, input.request, input.approval);
}

export function getBusinessExecutionPackageStateForSession(
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
} {
  const approvalState = getBusinessExecutionApprovalStateForSession(sessionId, ctx);
  const pkg = resolveSessionBusinessExecutionPackage(sessionId);
  const isEffectivelyPackaged = isCurrentBusinessExecutionPackage({
    pkg,
    request: approvalState.request,
    approval: approvalState.approval,
    isEffectivelyApproved: approvalState.isEffectivelyApproved,
  });
  return {
    pkg,
    request: approvalState.request,
    approval: approvalState.approval,
    validity: approvalState.validity,
    isEffectivelyApproved: approvalState.isEffectivelyApproved,
    isEffectivelyPackaged,
  };
}
