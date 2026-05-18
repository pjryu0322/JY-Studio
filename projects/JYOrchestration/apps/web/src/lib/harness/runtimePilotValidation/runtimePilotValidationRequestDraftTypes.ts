/**
 * Pilot Validation Phase 3 — validation request draft & approval UI contracts (read-only).
 */

import type { RuntimeSafeEchoAdapterActualFlagsDisabled } from "./runtimeSafeEchoAdapterContractTypes";

export type RuntimePilotValidationRequestDraftStatus = "draft_ready" | "watch" | "blocked" | "not_ready";

export type RuntimePilotValidationRequestDraftMode =
  | "read_only_draft"
  | "operator_approval_required"
  | "blocked";

export type RuntimePilotValidationRequestDraft = Readonly<
  RuntimeSafeEchoAdapterActualFlagsDisabled & {
    mode: "runtime_pilot_validation_request_draft";
    draftStatus: RuntimePilotValidationRequestDraftStatus;
    draftMode: RuntimePilotValidationRequestDraftMode;
    validationRequestIdCandidate: string;
    requestedValidationMode: "safe_echo_contract_only";
    projectIdRequired: true;
    taskIdOptional: true;
    userApprovalRequired: true;
    operatorApprovalRequired: true;
    auditTraceRequired: true;
    rollbackPlanRequired: true;
    sourceSummaryRows: readonly string[];
    prohibitedOperationRows: readonly string[];
    blockers: readonly string[];
    warnings: readonly string[];
    recommendations: readonly string[];
  }
>;

export type RuntimePilotValidationOperatorApprovalSnapshotStatus =
  | "approval_snapshot_ready"
  | "review_required"
  | "blocked"
  | "not_ready";

export type RuntimePilotValidationOperatorApprovalSnapshot = Readonly<{
  mode: "runtime_pilot_validation_operator_approval_snapshot";
  actualApprovalEnforcementEnabled: false;
  actualExecutionBlockingEnabled: false;
  actualMergeBlockingEnabled: false;
  approvalSnapshotStatus: RuntimePilotValidationOperatorApprovalSnapshotStatus;
  approvalSourceLayer: "runtimeOperatorApprovalSummary";
  approvalRequiredBeforeAnyInvocation: true;
  approvalDoesNotTriggerExecution: true;
  approvalRows: readonly string[];
  missingApprovalRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotValidationAuditTraceCandidateStatus =
  | "audit_trace_candidate_ready"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimePilotValidationAuditTraceCandidate = Readonly<{
  mode: "runtime_pilot_validation_audit_trace_candidate";
  actualExecutionEnabled: false;
  actualAdapterInvocationEnabled: false;
  auditTraceStatus: RuntimePilotValidationAuditTraceCandidateStatus;
  auditTraceIdCandidate: string;
  traceSourceLayers: readonly string[];
  traceRows: readonly string[];
  missingTraceRows: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePilotValidationRollbackPlanCandidateStatus =
  | "rollback_plan_candidate_ready"
  | "watch"
  | "blocked"
  | "not_ready";

export type RuntimePilotValidationRollbackPlanCandidate = Readonly<{
  mode: "runtime_pilot_validation_rollback_plan_candidate";
  actualRollbackExecutionEnabled: false;
  actualExecutionEnabled: false;
  rollbackPlanStatus: RuntimePilotValidationRollbackPlanCandidateStatus;
  rollbackPlanCandidateId: string;
  rollbackScope: "metadata_only";
  rollbackDoesNotExecute: true;
  rollbackRows: readonly string[];
  missingRollbackRows: readonly string[];
  recommendations: readonly string[];
}>;
