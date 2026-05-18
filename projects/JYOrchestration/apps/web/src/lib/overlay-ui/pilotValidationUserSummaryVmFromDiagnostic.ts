/**
 * Pilot Validation Phase 1.5 — diagnostic API responseData → user VM (read-only).
 */

import type { RuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationTypes";
import type {
  RuntimeSafeEchoAdapterContractStatus,
  RuntimeSafeEchoAdapterMode,
} from "@/lib/harness/runtimePilotValidation/runtimeSafeEchoAdapterContractTypes";
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

  if (
    !isRecord(summaryRaw) ||
    !isRecord(candidateRaw) ||
    !isRecord(policyRaw) ||
    !isRecord(approvalRaw) ||
    !isRecord(safeEchoRaw) ||
    !isRecord(boundaryRaw)
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

  if (
    !validationStatus ||
    !executionMode ||
    operatorReview === null ||
    !approvalReadiness ||
    !userVisibleSummaryKo ||
    !safeEchoContractStatus ||
    !safeEchoAdapterMode
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
  };

  return buildPilotValidationUserSummaryVmFromInput(input);
}
