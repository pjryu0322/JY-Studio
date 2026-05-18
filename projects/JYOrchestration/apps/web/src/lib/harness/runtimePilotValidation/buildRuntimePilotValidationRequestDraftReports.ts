/**
 * Pilot Validation Phase 3 — validation request draft reports (no invocation).
 */

import type { RuntimeSemanticPlanningReportsBeforePilotValidation } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import { PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO } from "./runtimePilotValidationConstants";
import type { RuntimePilotValidationReadOnlyChainSummary } from "./runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterContractSummary,
  RuntimeSandboxDryRunBoundary,
} from "./runtimeSafeEchoAdapterContractTypes";
import { RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED } from "./runtimeSafeEchoAdapterContractConstants";
import {
  buildAuditTraceIdCandidate,
  buildRollbackPlanCandidateId,
  buildValidationRequestIdCandidate,
  resolveAuditTraceCandidateStatus,
  resolveOperatorApprovalSnapshotStatus,
  resolveRollbackPlanCandidateStatus,
  resolveRuntimePilotValidationRequestDraftMode,
  resolveRuntimePilotValidationRequestDraftStatus,
} from "./runtimePilotValidationRequestDraftCheckHelpers";
import type {
  RuntimePilotValidationAuditTraceCandidate,
  RuntimePilotValidationOperatorApprovalSnapshot,
  RuntimePilotValidationRequestDraft,
  RuntimePilotValidationRollbackPlanCandidate,
} from "./runtimePilotValidationRequestDraftTypes";

type SafeEchoReports = Readonly<{
  runtimeSafeEchoAdapterContractSummary: RuntimeSafeEchoAdapterContractSummary;
  runtimeSandboxDryRunBoundary: RuntimeSandboxDryRunBoundary;
}>;

function buildRequestDraft(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  safeEcho: SafeEchoReports
): RuntimePilotValidationRequestDraft {
  const contract = safeEcho.runtimeSafeEchoAdapterContractSummary;
  const boundary = safeEcho.runtimeSandboxDryRunBoundary;
  const draftStatus = resolveRuntimePilotValidationRequestDraftStatus({ contract, boundary });
  const draftMode = resolveRuntimePilotValidationRequestDraftMode(draftStatus);

  const validationRequestIdCandidate = buildValidationRequestIdCandidate(
    contract.contractStatus,
    chainSummary.validationStatus
  );

  const blockers = mergeSortedUniqueKo([
    ...contract.blockers,
    ...(draftStatus === "blocked" ? ["pilot_validation_request_draft:blocked"] : []),
  ]);
  const warnings = mergeSortedUniqueKo([
    ...contract.warnings,
    ...(draftStatus === "watch" ? ["pilot_validation_request_draft:watch"] : []),
  ]);

  const sourceSummaryRows = mergeSortedUniqueKo([
    chainSummary.userVisibleSummaryKo,
    contract.rationaleKo,
    ...chainSummary.finalProofSummary.slice(0, 2),
  ]);

  return {
    mode: "runtime_pilot_validation_request_draft",
    ...RUNTIME_SAFE_ECHO_ADAPTER_ACTUAL_FLAGS_DISABLED,
    draftStatus,
    draftMode,
    validationRequestIdCandidate,
    requestedValidationMode: "safe_echo_contract_only",
    projectIdRequired: true,
    taskIdOptional: true,
    userApprovalRequired: true,
    operatorApprovalRequired: boundary.operatorApprovalRequiredBeforeInvocation,
    auditTraceRequired: boundary.auditTraceRequired,
    rollbackPlanRequired: boundary.rollbackPlanRequired,
    sourceSummaryRows,
    prohibitedOperationRows: PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO,
    blockers,
    warnings,
    recommendations: mergeSortedUniqueKo([
      ...contract.recommendations,
      "validation request draft는 metadata만 포함하며 actual invocation 없음",
    ]),
  };
}

function buildOperatorApprovalSnapshot(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  draft: RuntimePilotValidationRequestDraft
): RuntimePilotValidationOperatorApprovalSnapshot {
  const approval = reports.runtimeOperatorApprovalSummary;
  const approvalSnapshotStatus = resolveOperatorApprovalSnapshotStatus(
    approval.approvalReadiness,
    draft.draftStatus
  );

  const approvalRows = mergeSortedUniqueKo([
    ...approval.requiredReviewItems,
    `approvalReadiness:${approval.approvalReadiness}`,
  ]);
  const missingApprovalRows =
    approvalSnapshotStatus === "approval_snapshot_ready"
      ? ([] as readonly string[])
      : mergeSortedUniqueKo([...approval.approvalBlockers, "operator approval snapshot incomplete"]);

  return {
    mode: "runtime_pilot_validation_operator_approval_snapshot",
    actualApprovalEnforcementEnabled: false,
    actualExecutionBlockingEnabled: false,
    actualMergeBlockingEnabled: false,
    approvalSnapshotStatus,
    approvalSourceLayer: "runtimeOperatorApprovalSummary",
    approvalRequiredBeforeAnyInvocation: true,
    approvalDoesNotTriggerExecution: true,
    approvalRows,
    missingApprovalRows,
    recommendations: mergeSortedUniqueKo([
      ...approval.recommendations,
      "approval snapshot은 enforcement가 아니며 invocation을 트리거하지 않음",
    ]),
  };
}

function buildAuditTraceCandidate(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  contract: RuntimeSafeEchoAdapterContractSummary,
  draft: RuntimePilotValidationRequestDraft
): RuntimePilotValidationAuditTraceCandidate {
  const audit = reports.runtimeAuditReadinessSummary;
  const auditTraceStatus = resolveAuditTraceCandidateStatus(audit.auditReadiness, draft.draftStatus);

  const traceRows = mergeSortedUniqueKo([
    ...audit.auditFindings,
    chainSummary.operatorVisibleSummaryKo,
  ]);
  const missingTraceRows =
    auditTraceStatus === "audit_trace_candidate_ready"
      ? ([] as readonly string[])
      : mergeSortedUniqueKo(["audit trace candidate metadata incomplete"]);

  return {
    mode: "runtime_pilot_validation_audit_trace_candidate",
    actualExecutionEnabled: false,
    actualAdapterInvocationEnabled: false,
    auditTraceStatus,
    auditTraceIdCandidate: buildAuditTraceIdCandidate(contract.contractStatus, chainSummary.validationStatus),
    traceSourceLayers: [
      "runtimePilotValidationReadOnlyChainSummary",
      "runtimeSafeEchoAdapterContractSummary",
      "runtimeOperatorApprovalSummary",
    ],
    traceRows,
    missingTraceRows,
    recommendations: mergeSortedUniqueKo([
      ...audit.recommendations,
      "audit trace candidate는 실행 trace가 아님",
    ]),
  };
}

function buildRollbackPlanCandidate(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  contract: RuntimeSafeEchoAdapterContractSummary,
  draft: RuntimePilotValidationRequestDraft
): RuntimePilotValidationRollbackPlanCandidate {
  const rollback = reports.runtimeRollbackReadinessSummary;
  const rollbackPlanStatus = resolveRollbackPlanCandidateStatus(rollback.rollbackReadiness, draft.draftStatus);

  const rollbackRows = mergeSortedUniqueKo([
    ...rollback.rollbackPrerequisites,
    ...rollback.rollbackAuditTrailHints,
  ]);
  const missingRollbackRows =
    rollbackPlanStatus === "rollback_plan_candidate_ready"
      ? ([] as readonly string[])
      : mergeSortedUniqueKo([...rollback.rollbackBlockers, "rollback plan candidate metadata incomplete"]);

  return {
    mode: "runtime_pilot_validation_rollback_plan_candidate",
    actualRollbackExecutionEnabled: false,
    actualExecutionEnabled: false,
    rollbackPlanStatus,
    rollbackPlanCandidateId: buildRollbackPlanCandidateId(
      contract.contractStatus,
      chainSummary.validationStatus
    ),
    rollbackScope: "metadata_only",
    rollbackDoesNotExecute: true,
    rollbackRows,
    missingRollbackRows,
    recommendations: mergeSortedUniqueKo([
      ...rollback.recommendations,
      "rollback plan candidate는 actual rollback execution 없음",
    ]),
  };
}

export function buildRuntimePilotValidationRequestDraftReports(
  reports: RuntimeSemanticPlanningReportsBeforePilotValidation,
  chainSummary: RuntimePilotValidationReadOnlyChainSummary,
  safeEcho: SafeEchoReports
): Readonly<{
  runtimePilotValidationRequestDraft: RuntimePilotValidationRequestDraft;
  runtimePilotValidationOperatorApprovalSnapshot: RuntimePilotValidationOperatorApprovalSnapshot;
  runtimePilotValidationAuditTraceCandidate: RuntimePilotValidationAuditTraceCandidate;
  runtimePilotValidationRollbackPlanCandidate: RuntimePilotValidationRollbackPlanCandidate;
}> {
  const runtimePilotValidationRequestDraft = buildRequestDraft(reports, chainSummary, safeEcho);
  return {
    runtimePilotValidationRequestDraft,
    runtimePilotValidationOperatorApprovalSnapshot: buildOperatorApprovalSnapshot(
      reports,
      runtimePilotValidationRequestDraft
    ),
    runtimePilotValidationAuditTraceCandidate: buildAuditTraceCandidate(
      reports,
      chainSummary,
      safeEcho.runtimeSafeEchoAdapterContractSummary,
      runtimePilotValidationRequestDraft
    ),
    runtimePilotValidationRollbackPlanCandidate: buildRollbackPlanCandidate(
      reports,
      chainSummary,
      safeEcho.runtimeSafeEchoAdapterContractSummary,
      runtimePilotValidationRequestDraft
    ),
  };
}
