/**
 * H43.5 — limited pilot readiness review **alignment report**(read-only; H44 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  PILOT_READINESS_ALIGNMENT_CHECKLIST_LABEL_ROWS,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
} from "./runtimeLimitedPilotReadinessReviewConstants";
import {
  envelopeIncludes,
  isRuntimePilotExecutionForbiddenProofComplete,
  isRuntimePilotNoExecutionProofValid,
  pilotReadinessBlockersAligned,
  pilotReadinessForbiddenIncludes,
  readLimitedPilotReadinessUpstreamContext,
  resolvePilotReadinessReviewAlignmentStatus,
  runtimeChecklistHasLabel,
  PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER,
  PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER,
} from "./runtimeLimitedPilotReadinessReviewCheckHelpers";
import type {
  RuntimeLimitedPilotReadinessReviewAlignmentReport,
  RuntimeLimitedPilotReadinessReviewSummary,
  RuntimeLimitedPilotReadinessReviewViolationReport,
  RuntimePilotContractHardeningBoundary,
  RuntimePilotContractReadinessChecklist,
  RuntimePilotExecutionForbiddenProof,
  RuntimePilotNoExecutionProof,
  RuntimePilotReadinessBlockerReport,
  RuntimePilotReadinessInputEnvelope,
  RuntimePilotReadinessOutputEnvelope,
} from "./runtimeLimitedPilotReadinessReviewTypes";

export function buildRuntimeLimitedPilotReadinessReviewAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeLimitedPilotReadinessReview;
  readonly summary: RuntimeLimitedPilotReadinessReviewSummary;
  readonly boundary: RuntimePilotContractHardeningBoundary;
  readonly inputEnvelope: RuntimePilotReadinessInputEnvelope;
  readonly outputEnvelope: RuntimePilotReadinessOutputEnvelope;
  readonly noExecutionProof: RuntimePilotNoExecutionProof;
  readonly forbiddenProof: RuntimePilotExecutionForbiddenProof;
  readonly checklist: RuntimePilotContractReadinessChecklist;
  readonly blockerReport: RuntimePilotReadinessBlockerReport;
  readonly reviewViolation: RuntimeLimitedPilotReadinessReviewViolationReport;
}): RuntimeLimitedPilotReadinessReviewAlignmentReport {
  const {
    reports,
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noExecutionProof,
    forbiddenProof,
    checklist,
    blockerReport,
    reviewViolation,
  } = input;
  const upstream = readLimitedPilotReadinessUpstreamContext(reports);
  const findings: string[] = [];

  if (
    summary.reviewStatus === "limited_pilot_readiness_metadata_ready" &&
    upstream.pilotBoundaryFinalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("limited pilot boundary final safety gate misaligned with readiness review summary");
  }
  if (boundary.boundarySourceLayer !== PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER) {
    findings.push(`boundary.boundarySourceLayer must be ${PILOT_CONTRACT_HARDENING_BOUNDARY_SOURCE_LAYER}`);
  }
  if (boundary.boundaryTargetLayer !== PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER) {
    findings.push(`boundary.boundaryTargetLayer must be ${PILOT_CONTRACT_HARDENING_BOUNDARY_TARGET_LAYER}`);
  }
  if (!pilotReadinessForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual pilot activation")) {
    findings.push("forbiddenBoundaryOperations missing actual pilot activation");
  }
  if (!pilotReadinessForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual pilot execution")) {
    findings.push("forbiddenBoundaryOperations missing actual pilot execution");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "limitedPilotBoundaryFinalGate")) {
    findings.push("input envelope misaligned with limited pilot boundary final gate");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "limitedPilotBoundarySummary")) {
    findings.push("input envelope misaligned with limited pilot boundary summary");
  }
  if (!envelopeIncludes(inputEnvelope.envelopeRows, "limitedPilotBoundaryPolicy")) {
    findings.push("input envelope misaligned with limited pilot boundary policy");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "pilotNoExecutionProofDiagnosticOnly")) {
    findings.push("output envelope misaligned with pilot no-execution proof");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "pilotExecutionForbiddenProofComplete")) {
    findings.push("output envelope misaligned with pilot execution-forbidden proof");
  }
  if (!envelopeIncludes(outputEnvelope.envelopeRows, "auditTraceMetadata")) {
    findings.push("output envelope missing audit trace metadata");
  }
  if (!isRuntimePilotNoExecutionProofValid(noExecutionProof)) {
    findings.push("pilot no-execution proof misaligned with actual false flags");
  }
  if (!isRuntimePilotExecutionForbiddenProofComplete(forbiddenProof)) {
    findings.push("pilot execution-forbidden proof misaligned with forbidden boundary operations");
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "pilot no-execution proof diagnosticOnly")) {
    findings.push("checklist misaligned with pilot no-execution proof");
  }
  if (!runtimeChecklistHasLabel(checklist.checklist, "pilot execution-forbidden proof complete")) {
    findings.push("checklist misaligned with pilot execution-forbidden proof");
  }
  if (!pilotReadinessBlockersAligned(blockerReport.blockers, summary.reviewBlockers)) {
    findings.push("blocker report misaligned with summary.reviewBlockers");
  }
  for (const label of PILOT_READINESS_ALIGNMENT_CHECKLIST_LABEL_ROWS) {
    if (!runtimeChecklistHasLabel(checklist.checklist, label)) {
      findings.push(`checklist missing ${label}`);
    }
  }
  if (
    summary.reviewStatus === "limited_pilot_readiness_metadata_ready" &&
    (reviewViolation.actualFlagViolations.length > 0 ||
      reviewViolation.proofViolations.length > 0 ||
      reviewViolation.forbiddenProofViolations.length > 0 ||
      reviewViolation.wordingRiskFindings.length > 0)
  ) {
    findings.push("limited_pilot_readiness_metadata_ready requires empty readiness review violations");
  }

  const alignmentStatus = resolvePilotReadinessReviewAlignmentStatus(findings);

  return {
    mode: "runtime_limited_pilot_readiness_review_alignment_report",
    ...RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(alignmentStatus === "aligned_metadata"
        ? ["H43.5: pilot readiness review aligned_metadata — H44 entry 후보(pilot activation 없음)"]
        : []),
      ...(alignmentStatus === "partial"
        ? ["H43.5: pilot readiness review partial alignment — boundary·envelope·proof 재검토"]
        : []),
      ...(alignmentStatus === "failed"
        ? ["H43.5: pilot readiness review alignment failed — checklist·blocker·proof 정렬"]
        : []),
    ]),
  };
}
