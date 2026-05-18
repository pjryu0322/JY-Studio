/**
 * Business execution package: bundled artifact after approval (NOT Stage1/Stage2, NOT launch).
 */

import { isBusinessApprovalForRequest, type BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { CollaborationOfficialTaskDraft } from "@/lib/workflow/collaborationActionContract";

export type BusinessExecutionPackage = {
  packageId: string;
  requestId: string;
  approvalId: string;
  requirementId: string | null;
  sessionId: string;
  snapshotId: string;
  candidateTaskIds: string[];
  candidateTasks: CollaborationOfficialTaskDraft[];
  createdAtIso: string;
  status: "packaged";
  source: "business_execution_package";
  summary?: string;
  note?: string;
  packageLabel?: string;
};

function packageId(): string {
  return `bizpkg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Builds an in-memory package from an approved business execution request.
 * Caller must pass a request and approval that are currently aligned and business-approved.
 */
export function createBusinessExecutionPackage(input: {
  request: BusinessExecutionRequest;
  approval: BusinessExecutionApproval;
  summary?: string;
  note?: string;
  packageLabel?: string;
}): BusinessExecutionPackage {
  if (!isBusinessApprovalForRequest(input.request, input.approval)) {
    throw new Error("createBusinessExecutionPackage: approval does not match the given request");
  }
  return {
    packageId: packageId(),
    requestId: input.request.requestId,
    approvalId: input.approval.approvalId,
    requirementId: input.request.requirementId,
    sessionId: input.request.sessionId,
    snapshotId: input.request.snapshotId,
    candidateTaskIds: [...input.request.candidateTaskIds],
    candidateTasks: input.request.candidateTasks.map((t) => ({ ...t })),
    createdAtIso: new Date().toISOString(),
    status: "packaged",
    source: "business_execution_package",
    summary: input.summary,
    note: input.note,
    packageLabel: input.packageLabel,
  };
}

export function isBusinessPackageForApprovedRequest(
  pkg: BusinessExecutionPackage | undefined,
  request: BusinessExecutionRequest | undefined,
  approval: BusinessExecutionApproval | undefined
): boolean {
  if (!pkg || !request || !approval) return false;
  return (
    pkg.status === "packaged" &&
    pkg.source === "business_execution_package" &&
    pkg.requestId === request.requestId &&
    pkg.approvalId === approval.approvalId &&
    pkg.sessionId === request.sessionId &&
    pkg.snapshotId === request.snapshotId
  );
}
