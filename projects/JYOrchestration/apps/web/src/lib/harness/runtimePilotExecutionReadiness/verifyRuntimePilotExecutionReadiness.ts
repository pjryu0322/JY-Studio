/**
 * H44.5 — pilot execution readiness **정합성 검증**(read-only).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import {
  PILOT_EXECUTION_READINESS_VERIFICATION_CHECKLIST_LABEL_ROWS,
  RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
} from "./runtimePilotExecutionReadinessConstants";
import {
  envelopeIncludes,
  isRuntimeFinalPilotExecutionForbiddenProofComplete,
  isRuntimeFinalPilotNoExecutionProofValid,
  pilotExecutionReadinessBlockersAligned,
  resolvePilotExecutionReadinessVerificationStatus,
  runtimeChecklistHasLabel,
  PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER,
  PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER,
} from "./runtimePilotExecutionReadinessCheckHelpers";
import type {
  RuntimeFinalPilotExecutionForbiddenProof,
  RuntimeFinalPilotNoExecutionProof,
  RuntimePilotExecutionReadinessBlockerReport,
  RuntimePilotExecutionReadinessBoundary,
  RuntimePilotExecutionReadinessChecklist,
  RuntimePilotExecutionReadinessInputEnvelope,
  RuntimePilotExecutionReadinessOutputEnvelope,
  RuntimePilotExecutionReadinessSummary,
  RuntimePilotExecutionReadinessVerificationReport,
} from "./runtimePilotExecutionReadinessTypes";

export function verifyRuntimePilotExecutionReadiness(input: {
  readonly summary: RuntimePilotExecutionReadinessSummary;
  readonly boundary: RuntimePilotExecutionReadinessBoundary;
  readonly inputEnvelope: RuntimePilotExecutionReadinessInputEnvelope;
  readonly outputEnvelope: RuntimePilotExecutionReadinessOutputEnvelope;
  readonly noExecutionProof: RuntimeFinalPilotNoExecutionProof;
  readonly forbiddenProof: RuntimeFinalPilotExecutionForbiddenProof;
  readonly checklist: RuntimePilotExecutionReadinessChecklist;
  readonly blockerReport: RuntimePilotExecutionReadinessBlockerReport;
}): RuntimePilotExecutionReadinessVerificationReport {
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
    summary.readinessStatus === "pilot_execution_readiness_metadata_ready" &&
    summary.readinessMode !== "metadata_only"
  ) {
    findings.push("pilot_execution_readiness_metadata_ready requires readinessMode metadata_only");
  }
  if (summary.readinessStatus === "blocked" && summary.readinessBlockers.length === 0) {
    findings.push("blocked readinessStatus requires readinessBlockers");
  }
  if (boundary.boundarySourceLayer !== PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER) {
    findings.push(`boundary.boundarySourceLayer must be ${PILOT_EXECUTION_READINESS_BOUNDARY_SOURCE_LAYER}`);
  }
  if (boundary.boundaryTargetLayer !== PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER) {
    findings.push(`boundary.boundaryTargetLayer must be ${PILOT_EXECUTION_READINESS_BOUNDARY_TARGET_LAYER}`);
  }
  if (boundary.forbiddenBoundaryOperations.length === 0) {
    findings.push("boundary.forbiddenBoundaryOperations must be non-empty");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "runtimeLimitedPilotReadinessReviewFinalSafetyGate")) {
    findings.push("input envelope missing runtimeLimitedPilotReadinessReviewFinalSafetyGate");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewVerification")) {
    findings.push("input envelope missing runtimeLimitedPilotReadinessReviewVerificationReport");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewAlignment")) {
    findings.push("input envelope missing runtimeLimitedPilotReadinessReviewAlignmentReport");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "reviewViolationCount")) {
    findings.push("input envelope missing runtimeLimitedPilotReadinessReviewViolationReport");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "finalPilotNoExecutionProofDiagnosticOnly")) {
    findings.push("output envelope missing final pilot no-execution proof metadata");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "finalPilotExecutionForbiddenProofComplete")) {
    findings.push("output envelope missing final pilot execution-forbidden proof metadata");
  }
  if (!isRuntimeFinalPilotNoExecutionProofValid(noExecutionProof)) {
    findings.push("finalPilotNoExecutionProof.diagnosticOnly must be true");
  }
  if (!isRuntimeFinalPilotExecutionForbiddenProofComplete(forbiddenProof)) {
    findings.push("finalPilotExecutionForbiddenProof incomplete");
  }
  for (const label of PILOT_EXECUTION_READINESS_VERIFICATION_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "final pilot no-execution proof diagnosticOnly")) {
    findings.push("checklist missing final pilot no-execution proof diagnosticOnly");
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "final pilot execution-forbidden proof complete")) {
    findings.push("checklist missing final pilot execution-forbidden proof complete");
  }
  if (!pilotExecutionReadinessBlockersAligned(blockerReport.blockers, summary.readinessBlockers)) {
    findings.push("blocker report misaligned with summary.readinessBlockers");
  }

  const verificationStatus = resolvePilotExecutionReadinessVerificationStatus(findings);

  return {
    mode: "runtime_pilot_execution_readiness_verification_report",
    ...RUNTIME_PILOT_EXECUTION_READINESS_ACTUAL_FLAGS_DISABLED,
    verificationStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(verificationStatus === "verified_metadata"
        ? ["H44.5: pilot execution readiness verified_metadata — H45 entry 후보(pilot activation 없음)"]
        : []),
      ...(verificationStatus === "partial"
        ? ["H44.5: pilot execution readiness verification partial — envelope·checklist 정렬"]
        : []),
      ...(verificationStatus === "failed"
        ? ["H44.5: pilot execution readiness verification failed — boundary·proof·blocker 정렬"]
        : []),
    ]),
  };
}
