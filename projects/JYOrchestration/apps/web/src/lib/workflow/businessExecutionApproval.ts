/**
 * Business execution request finalization (NOT Stage1/Stage2, NOT actual launch).
 */

import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";

export type BusinessExecutionApproval = {
  approvalId: string;
  requestId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  approvedAtIso: string;
  status: "approved";
  source: "business_execution_gate";
  approvedBy?: "user" | "local";
  note?: string;
};

function approvalId(): string {
  return `bizappr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function approveBusinessExecutionRequest(input: {
  request: BusinessExecutionRequest;
  approvedBy?: "user" | "local";
  note?: string;
}): BusinessExecutionApproval {
  return {
    approvalId: approvalId(),
    requestId: input.request.requestId,
    requirementId: input.request.requirementId,
    sessionId: input.request.sessionId,
    snapshotId: input.request.snapshotId,
    approvedAtIso: new Date().toISOString(),
    status: "approved",
    source: "business_execution_gate",
    approvedBy: input.approvedBy,
    note: input.note,
  };
}

export function isBusinessApprovalForRequest(
  request: BusinessExecutionRequest | undefined,
  approval: BusinessExecutionApproval | undefined
): boolean {
  if (!request || !approval) return false;
  return (
    approval.status === "approved" &&
    approval.requestId === request.requestId &&
    approval.snapshotId === request.snapshotId &&
    approval.sessionId === request.sessionId
  );
}
