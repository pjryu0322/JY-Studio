/**
 * Pilot Validation Phase 3 — request draft status resolution (read-only).
 */

import type {
  RuntimeAuditReadiness,
  RuntimeOperatorApprovalReadiness,
  RuntimeRollbackReadiness,
} from "@/lib/harness/runtimeOperatorApproval/runtimeOperatorApprovalTypes";
import type { RuntimeSafeEchoAdapterContractStatus } from "./runtimeSafeEchoAdapterContractTypes";
import type { RuntimeSandboxDryRunBoundary } from "./runtimeSafeEchoAdapterContractTypes";
import type { RuntimeSafeEchoAdapterContractSummary } from "./runtimeSafeEchoAdapterContractTypes";
import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";
import type {
  RuntimePilotValidationAuditTraceCandidateStatus,
  RuntimePilotValidationOperatorApprovalSnapshotStatus,
  RuntimePilotValidationRequestDraftMode,
  RuntimePilotValidationRequestDraftStatus,
  RuntimePilotValidationRollbackPlanCandidateStatus,
} from "./runtimePilotValidationRequestDraftTypes";

export function buildValidationRequestIdCandidate(
  contractStatus: RuntimeSafeEchoAdapterContractStatus,
  validationStatus: RuntimePilotValidationReadOnlyChainSummary["validationStatus"]
): string {
  return `pilot-validation:${contractStatus}:${validationStatus}`;
}

export function buildAuditTraceIdCandidate(
  contractStatus: RuntimeSafeEchoAdapterContractStatus,
  validationStatus: RuntimePilotValidationReadOnlyChainSummary["validationStatus"]
): string {
  return `audit-trace:pilot-validation:${contractStatus}:${validationStatus}`;
}

export function buildRollbackPlanCandidateId(
  contractStatus: RuntimeSafeEchoAdapterContractStatus,
  validationStatus: RuntimePilotValidationReadOnlyChainSummary["validationStatus"]
): string {
  return `rollback-plan:pilot-validation:${contractStatus}:${validationStatus}`;
}

export function resolveRuntimePilotValidationRequestDraftStatus(input: Readonly<{
  contract: RuntimeSafeEchoAdapterContractSummary;
  boundary: RuntimeSandboxDryRunBoundary;
}>): RuntimePilotValidationRequestDraftStatus {
  const { contract, boundary } = input;

  if (contract.contractStatus === "blocked" || contract.blockers.length > 0) {
    return "blocked";
  }

  if (contract.contractStatus === "watch" || contract.warnings.length > 0) {
    return "watch";
  }

  if (
    contract.contractStatus === "contract_ready" &&
    boundary.operatorApprovalRequiredBeforeInvocation === true &&
    boundary.auditTraceRequired === true &&
    boundary.rollbackPlanRequired === true
  ) {
    return "draft_ready";
  }

  return "not_ready";
}

export function resolveRuntimePilotValidationRequestDraftMode(
  draftStatus: RuntimePilotValidationRequestDraftStatus
): RuntimePilotValidationRequestDraftMode {
  if (draftStatus === "blocked") {
    return "blocked";
  }
  if (draftStatus === "draft_ready") {
    return "operator_approval_required";
  }
  return "read_only_draft";
}

export function resolveOperatorApprovalSnapshotStatus(
  approvalReadiness: RuntimeOperatorApprovalReadiness,
  draftStatus: RuntimePilotValidationRequestDraftStatus
): RuntimePilotValidationOperatorApprovalSnapshotStatus {
  if (approvalReadiness === "blocked" || draftStatus === "blocked") {
    return "blocked";
  }
  if (approvalReadiness === "review_required") {
    return "review_required";
  }
  if (approvalReadiness === "ready_for_review_metadata" || approvalReadiness === "not_required") {
    return "approval_snapshot_ready";
  }
  return "not_ready";
}

export function resolveAuditTraceCandidateStatus(
  auditReadiness: RuntimeAuditReadiness,
  draftStatus: RuntimePilotValidationRequestDraftStatus
): RuntimePilotValidationAuditTraceCandidateStatus {
  if (auditReadiness === "blocked" || draftStatus === "blocked") {
    return "blocked";
  }
  if (auditReadiness === "watch" || draftStatus === "watch") {
    return "watch";
  }
  if (auditReadiness === "sufficient_metadata" && draftStatus === "draft_ready") {
    return "audit_trace_candidate_ready";
  }
  return "not_ready";
}

export function resolveRollbackPlanCandidateStatus(
  rollbackReadiness: RuntimeRollbackReadiness,
  draftStatus: RuntimePilotValidationRequestDraftStatus
): RuntimePilotValidationRollbackPlanCandidateStatus {
  if (rollbackReadiness === "blocked" || draftStatus === "blocked") {
    return "blocked";
  }
  if (rollbackReadiness === "metadata_watch" || draftStatus === "watch") {
    return "watch";
  }
  if (rollbackReadiness === "metadata_ready" && draftStatus === "draft_ready") {
    return "rollback_plan_candidate_ready";
  }
  return "not_ready";
}
