/**
 * Pilot Validation Phase 1.5 — diagnostic API responseData → user VM (read-only).
 */

import type { RuntimePilotValidationReadOnlyChainStatus } from "@/lib/harness/runtimePilotValidation/runtimePilotValidationTypes";
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

  if (!isRecord(summaryRaw) || !isRecord(candidateRaw) || !isRecord(policyRaw) || !isRecord(approvalRaw)) {
    return null;
  }

  const validationStatus = readValidationStatus(summaryRaw.validationStatus);
  const executionMode = readExecutionMode(candidateRaw.executionMode);
  const operatorReview = readBoolean(policyRaw.operatorReviewBeforeControlledPilotExecution);
  const approvalReadiness = readApprovalReadiness(approvalRaw.approvalReadiness);
  const userVisibleSummaryKo = readString(summaryRaw.userVisibleSummaryKo);

  if (
    !validationStatus ||
    !executionMode ||
    operatorReview === null ||
    !approvalReadiness ||
    !userVisibleSummaryKo
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
  };

  return buildPilotValidationUserSummaryVmFromInput(input);
}
