/**
 * H43.5 — limited pilot readiness review **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  PILOT_READINESS_VERIFICATION_CHECKLIST_LABEL_ROWS,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotReadinessReviewConstants";
import {
  envelopeIncludes,
  isRuntimePilotExecutionForbiddenProofComplete,
  isRuntimePilotNoExecutionProofValid,
  pilotReadinessBlockersAligned,
  resolvePilotReadinessReviewVerificationStatus,
  runtimeChecklistHasLabel,
  PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER,
  PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER,
} from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import type {
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimeLimitedPilotReadinessReviewVerificationReport,
  RuntimePilotContractHardeningBoundary,
  RuntimePilotContractReadinessChecklist,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
  RuntimePilotReadinessInputEnvelope,
  RuntimePilotReadinessOutputEnvelope,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function verifyRuntimeLimitedPilotReadinessReview(input: {
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly boundary: RuntimePilotContractHardeningBoundary;
  readonly inputEnvelope: RuntimePilotReadinessInputEnvelope;
  readonly outputEnvelope: RuntimePilotReadinessOutputEnvelope;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
  readonly checklist: RuntimePilotContractReadinessChecklist;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
}): RuntimeLimitedPilotReadinessReviewVerificationReport {
  const {
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noExecutionProof,
    forbiddenProof,
    checklist,
    blockerReport,
  } = input;
  const findings: string[] = [];

  if (
    summary.reviewStatus === "limited_pilot_readiness_metadata_ready" &&
    summary.reviewMode !== "metadata_only"
  ) {
    findings.push("limited_pilot_readiness_metadata_ready requires reviewMode metadata_only");
  }
  if (summary.reviewStatus === "blocked" && summary.reviewBlockers.length === 0) {
    findings.push("blocked reviewStatus requires reviewBlockers");
  }
  if (boundary.boundarySourceLayer !== PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER) {
    findings.push(`boundary.boundarySourceLayer must be ${PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER}`);
  }
  if (boundary.boundaryTargetLayer !== PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER) {
    findings.push(`boundary.boundaryTargetLayer must be ${PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER}`);
  }
  if (boundary.forbiddenBoundaryOperations.length === 0) {
    findings.push("boundary.forbiddenBoundaryOperations must be non-empty");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "runtimeLimitedPilotBoundaryFinalSafetyGate")) {
    findings.push("input envelope missing runtimeLimitedPilotBoundaryFinalSafetyGate");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "runtimeLimitedPilotBoundaryVerificationReport")) {
    findings.push("input envelope missing runtimeLimitedPilotBoundaryVerificationReport");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "runtimeLimitedPilotBoundaryAlignmentReport")) {
    findings.push("input envelope missing runtimeLimitedPilotBoundaryAlignmentReport");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "runtimeLimitedPilotBoundaryViolationReport")) {
    findings.push("input envelope missing runtimeLimitedPilotBoundaryViolationReport");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "pilotNoExecutionProofDiagnosticOnly")) {
    findings.push("output envelope missing pilot no-execution proof metadata");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "pilotExecutionForbiddenProofComplete")) {
    findings.push("output envelope missing pilot execution-forbidden proof metadata");
  }
  if (!isRuntimePilotNoExecutionProofValid(noExecutionProof)) {
    findings.push("pilotNoExecutionProof.diagnosticOnly must be true");
  }
  if (!isRuntimePilotExecutionForbiddenProofComplete(forbiddenProof)) {
    findings.push("pilotExecutionForbiddenProof incomplete");
  }
  for (const label of PILOT_READINESS_VERIFICATION_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "pilot no-execution proof diagnosticOnly")) {
    findings.push("checklist missing pilot no-execution proof diagnosticOnly");
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "pilot execution-forbidden proof complete")) {
    findings.push("checklist missing pilot execution-forbidden proof complete");
  }
  if (!pilotReadinessBlockersAligned(blockerReport.blockers, summary.reviewBlockers)) {
    findings.push("blocker report misaligned with summary.reviewBlockers");
  }

  const verificationStatus = resolvePilotReadinessReviewVerificationStatus(findings);

  return {
    mode: "runtime_limited_pilot_readiness_review_verification_report",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(verificationStatus === "verified_metadata"
        ? ["H43.5: pilot readiness review verified_metadata — H44 entry 후보(pilot activation 없음)"]
        : []),
      ...(verificationStatus === "partial"
        ? ["H43.5: pilot readiness review partial — boundary·envelope·proof 재검토"]
        : []),
      ...(verificationStatus === "failed"
        ? ["H43.5: pilot readiness review verification failed — checklist·blocker 정렬"]
        : []),
    ]),
  };
}
