/**
 * Pilot Validation Phase 1.5 — diagnostic API responseData → user VM (read-only).
 */

import type { RuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterContractStatus,
  RuntimeSafeEchoAdapterMode,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoAdapterContractTypes";
import type {
  RuntimePilotValidationAuditTraceCandidateStatus,
  RuntimePilotValidationOperatorApprovalSnapshotStatus,
  RuntimePilotValidationRequestDraftStatus,
  RuntimePilotValidationRollbackPlanCandidateStatus,
} from "@/lib/harness/runtimePilotValidation/runtimePilotValidationRequestDraftTypes";
import type {
  RuntimeSafeEchoInvocationSimulatorMode,
  RuntimeSafeEchoInvocationSimulatorStatus,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoInvocationSimulatorTypes";
import {
  buildPilotValidationUserSummaryVmFromInput,
  type PilotValidationUserSummaryBuildInput,
} from "./pilotValidationUserSummaryVm";
import type { PilotValidationUserSummaryVm } from "./pilotValidationUserSummaryVm";

const VALIDATION_STATUSES = new Set<RuntimePilotValidationReadOnlyChainStatus>([
  "ready_for_validation",
  "watch",
  "blocked",
  "not_ready",
]);

const SAFE_ECHO_CONTRACT_STATUSES = new Set<RuntimeSafeEchoAdapterContractStatus>([
  "contract_ready",
  "watch",
  "blocked",
  "not_ready",
]);

const SAFE_ECHO_ADAPTER_MODES = new Set<RuntimeSafeEchoAdapterMode>([
  "contract_only",
  "sandbox_dry_run_contract",
  "blocked",
]);

const REQUEST_DRAFT_STATUSES = new Set<RuntimePilotValidationRequestDraftStatus>([
  "draft_ready",
  "watch",
  "blocked",
  "not_ready",
]);

const APPROVAL_SNAPSHOT_STATUSES = new Set<RuntimePilotValidationOperatorApprovalSnapshotStatus>([
  "approval_snapshot_ready",
  "review_required",
  "blocked",
  "not_ready",
]);

const AUDIT_TRACE_STATUSES = new Set<RuntimePilotValidationAuditTraceCandidateStatus>([
  "audit_trace_candidate_ready",
  "watch",
  "blocked",
  "not_ready",
]);

const ROLLBACK_PLAN_STATUSES = new Set<RuntimePilotValidationRollbackPlanCandidateStatus>([
  "rollback_plan_candidate_ready",
  "watch",
  "blocked",
  "not_ready",
]);

const SIMULATOR_STATUSES = new Set<RuntimeSafeEchoInvocationSimulatorStatus>([
  "simulator_contract_ready",
  "watch",
  "blocked",
  "not_ready",
]);

const SIMULATOR_MODES = new Set<RuntimeSafeEchoInvocationSimulatorMode>([
  "simulator_contract_only",
  "read_only_echo_simulation_contract",
  "blocked",
]);

function readEnum<T extends string>(value: unknown, allowed: Set<T>): T | null {
  const s = readString(value);
  if (!s || !allowed.has(s as T)) {
    return null;
  }
  return s as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is string => typeof row === "string");
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readValidationStatus(value: unknown): RuntimePilotValidationReadOnlyChainStatus | null {
  const s = readString(value);
  if (!s || !VALIDATION_STATUSES.has(s as RuntimePilotValidationReadOnlyChainStatus)) {
    return null;
  }
  return s as RuntimePilotValidationReadOnlyChainStatus;
}

function readExecutionMode(value: unknown): PilotValidationUserSummaryBuildInput["executionMode"] | null {
  const s = readString(value);
  if (s === "metadata_only" || s === "disabled" || s === "blocked") {
    return s;
  }
  return null;
}

function readApprovalReadiness(value: unknown): PilotValidationUserSummaryBuildInput["approvalReadiness"] | null {
  const s = readString(value);
  if (
    s === "blocked" ||
    s === "review_required" ||
    s === "ready_for_review_metadata" ||
    s === "not_required"
  ) {
    return s;
  }
  return null;
}

export function buildPilotValidationUserSummaryVmFromDiagnosticData(
  data: Readonly<Record<string, unknown>>
): PilotValidationUserSummaryVm | null {
  const summaryRaw = data.runtimePilotValidationReadOnlyChainSummary;
  const candidateRaw = data.runtimeControlledPilotExecutionCandidateSummary;
  const policyRaw = data.runtimeControlledPilotExecutionCandidatePolicy;
  const approvalRaw = data.runtimeOperatorApprovalSummary;
  const safeEchoRaw = data.runtimeSafeEchoAdapterContractSummary;
  const boundaryRaw = data.runtimeSandboxDryRunBoundary;
  const draftRaw = data.runtimePilotValidationRequestDraft;
  const approvalSnapshotRaw = data.runtimePilotValidationOperatorApprovalSnapshot;
  const auditTraceRaw = data.runtimePilotValidationAuditTraceCandidate;
  const rollbackPlanRaw = data.runtimePilotValidationRollbackPlanCandidate;
  const simulatorRaw = data.runtimeSafeEchoInvocationSimulatorSummary;

  if (
    !isRecord(summaryRaw) ||
    !isRecord(candidateRaw) ||
    !isRecord(policyRaw) ||
    !isRecord(approvalRaw) ||
    !isRecord(safeEchoRaw) ||
    !isRecord(boundaryRaw) ||
    !isRecord(draftRaw) ||
    !isRecord(approvalSnapshotRaw) ||
    !isRecord(auditTraceRaw) ||
    !isRecord(rollbackPlanRaw) ||
    !isRecord(simulatorRaw)
  ) {
    return null;
  }

  const validationStatus = readValidationStatus(summaryRaw.validationStatus);
  const executionMode = readExecutionMode(candidateRaw.executionMode);
  const operatorReview = readBoolean(policyRaw.operatorReviewBeforeControlledPilotExecution);
  const approvalReadiness = readApprovalReadiness(approvalRaw.approvalReadiness);
  const userVisibleSummaryKo = readString(summaryRaw.userVisibleSummaryKo);
  const contractStatus = readString(safeEchoRaw.contractStatus);
  const adapterMode = readString(safeEchoRaw.adapterMode);
  const safeEchoContractStatus =
    contractStatus && SAFE_ECHO_CONTRACT_STATUSES.has(contractStatus as RuntimeSafeEchoAdapterContractStatus)
      ? (contractStatus as RuntimeSafeEchoAdapterContractStatus)
      : null;
  const safeEchoAdapterMode =
    adapterMode && SAFE_ECHO_ADAPTER_MODES.has(adapterMode as RuntimeSafeEchoAdapterMode)
      ? (adapterMode as RuntimeSafeEchoAdapterMode)
      : null;

  const requestDraftStatus = readEnum(draftRaw.draftStatus, REQUEST_DRAFT_STATUSES);
  const operatorApprovalSnapshotStatus = readEnum(
    approvalSnapshotRaw.approvalSnapshotStatus,
    APPROVAL_SNAPSHOT_STATUSES
  );
  const auditTraceCandidateStatus = readEnum(auditTraceRaw.auditTraceStatus, AUDIT_TRACE_STATUSES);
  const rollbackPlanCandidateStatus = readEnum(rollbackPlanRaw.rollbackPlanStatus, ROLLBACK_PLAN_STATUSES);
  const validationRequestIdCandidate = readString(draftRaw.validationRequestIdCandidate);
  const simulatorStatus = readEnum(simulatorRaw.simulatorStatus, SIMULATOR_STATUSES);
  const simulatorMode = readEnum(simulatorRaw.simulatorMode, SIMULATOR_MODES);

  if (
    !validationStatus ||
    !executionMode ||
    operatorReview === null ||
    !approvalReadiness ||
    !userVisibleSummaryKo ||
    !safeEchoContractStatus ||
    !safeEchoAdapterMode ||
    !requestDraftStatus ||
    !operatorApprovalSnapshotStatus ||
    !auditTraceCandidateStatus ||
    !rollbackPlanCandidateStatus ||
    !validationRequestIdCandidate ||
    !simulatorStatus ||
    !simulatorMode
  ) {
    return null;
  }

  const input: PilotValidationUserSummaryBuildInput = {
    validationStatus,
    topBlockers: readStringArray(summaryRaw.topBlockers),
    topWarnings: readStringArray(summaryRaw.topWarnings),
    userVisibleSummaryKo,
    finalProofSummary: readStringArray(summaryRaw.finalProofSummary),
    executionMode,
    operatorReviewBeforeControlledPilotExecution: operatorReview,
    approvalReadiness,
    safeEchoContractStatus,
    safeEchoAdapterMode,
    sandboxBoundaryTopForbiddenKo: readStringArray(boundaryRaw.forbiddenBoundaryOperations)[0] ?? null,
    requestDraftStatus,
    operatorApprovalSnapshotStatus,
    auditTraceCandidateStatus,
    rollbackPlanCandidateStatus,
    validationRequestIdCandidate,
    simulatorStatus,
    simulatorMode,
  };

  return buildPilotValidationUserSummaryVmFromInput(input);
}
