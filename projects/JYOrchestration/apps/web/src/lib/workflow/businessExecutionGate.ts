/**
 * Lightweight selectors for business execution approval (pre-execution only).
 * Composes stored request + approval with derived lifecycle validity.
 */

import { isBusinessApprovalForRequest, type BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import {
  resolveExecutionRequestValidity,
  resolveSessionBusinessExecutionApproval,
  resolveSessionBusinessExecutionRequest,
} from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionRequestValidityResult } from "@/lib/workflow/businessExecutionRequestValidity";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

/** Read latest stored approval for the session (alias for naming clarity). */
export function resolveBusinessExecutionApproval(
  sessionId: string | null | undefined
): BusinessExecutionApproval | undefined {
  return resolveSessionBusinessExecutionApproval(sessionId);
}

export function isCurrentBusinessExecutionRequestApproved(input: {
  request: BusinessExecutionRequest | undefined;
  approval: BusinessExecutionApproval | undefined;
  validity: ExecutionRequestValidityResult | null;
}): boolean {
  return (
    Boolean(input.request) &&
    input.validity?.status === "requested" &&
    isBusinessApprovalForRequest(input.request, input.approval)
  );
}

export function getBusinessExecutionApprovalStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): {
  request: BusinessExecutionRequest | undefined;
  approval: BusinessExecutionApproval | undefined;
  validity: ExecutionRequestValidityResult | null;
  isEffectivelyApproved: boolean;
} {
  const request = resolveSessionBusinessExecutionRequest(sessionId);
  const approval = resolveSessionBusinessExecutionApproval(sessionId);
  const validity = resolveExecutionRequestValidity({
    request,
    snapshot: ctx.snapshot,
    currentCandidateTaskIds: ctx.currentCandidateTaskIds,
    currentConfirmedTaskIds: ctx.currentConfirmedTaskIds,
  });
  const isEffectivelyApproved = isCurrentBusinessExecutionRequestApproved({ request, approval, validity });
  return { request, approval, validity, isEffectivelyApproved };
}
