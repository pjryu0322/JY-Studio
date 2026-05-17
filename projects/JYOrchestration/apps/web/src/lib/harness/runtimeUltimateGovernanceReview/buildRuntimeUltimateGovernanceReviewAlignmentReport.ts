/**
 * H40.5 — ultimate governance review **alignment report**(read-only; H41 entry).
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview } from "@/lib/harness/runtimeSemantic/runtimeSemanticPlanningReportStages";
import {
  FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER,
  FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
} from "./runtimeUltimateGovernanceReviewConstants";
import {
  isRuntimeOrchestrationForbiddenProofComplete,
  isRuntimeUltimateNoEnforcementProofValid,
  resolveUltimateGovernanceReviewAlignmentStatus,
  ultimateGovernanceBlockersAligned,
} from "./runtimeUltimateGovernanceReviewCheckHelpers";
import type {
  RuntimeFinalOrchestrationReadinessBoundary,
  RuntimeFinalOrchestrationReadinessChecklist,
  RuntimeOrchestrationForbiddenProof,
  RuntimeOrchestrationReadinessInputEnvelope,
  RuntimeOrchestrationReadinessOutputEnvelope,
  RuntimeUltimateGovernanceBlockerReport,
  RuntimeUltimateGovernanceReviewAlignmentReport,
  RuntimeUltimateGovernanceReviewSummary,
  RuntimeUltimateGovernanceReviewViolationReport,
  RuntimeUltimateNoEnforcementProof,
} from "./runtimeUltimateGovernanceReviewTypes";

function boundaryForbiddenIncludes(
  forbiddenBoundaryOperations: readonly string[],
  fragment: string
): boolean {
  return forbiddenBoundaryOperations.some((op) => op.toLowerCase().includes(fragment.toLowerCase()));
}

export function buildRuntimeUltimateGovernanceReviewAlignmentReport(input: {
  readonly reports: RuntimeSemanticPlanningReportsBeforeUltimateGovernanceReview;
  readonly summary: RuntimeUltimateGovernanceReviewSummary;
  readonly boundary: RuntimeFinalOrchestrationReadinessBoundary;
  readonly inputEnvelope: RuntimeOrchestrationReadinessInputEnvelope;
  readonly outputEnvelope: RuntimeOrchestrationReadinessOutputEnvelope;
  readonly noEnforcementProof: RuntimeUltimateNoEnforcementProof;
  readonly forbiddenProof: RuntimeOrchestrationForbiddenProof;
  readonly checklist: RuntimeFinalOrchestrationReadinessChecklist;
  readonly blockerReport: RuntimeUltimateGovernanceBlockerReport;
  readonly boundaryViolation: RuntimeUltimateGovernanceReviewViolationReport;
}): RuntimeUltimateGovernanceReviewAlignmentReport {
  const {
    reports,
    summary,
    boundary,
    inputEnvelope,
    outputEnvelope,
    noEnforcementProof,
    forbiddenProof,
    checklist,
    blockerReport,
    boundaryViolation,
  } = input;
  const finalGate = reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate;
  const findings: string[] = [];

  if (
    summary.reviewStatus === "ultimate_governance_metadata_ready" &&
    finalGate.finalGateStatus !== "ready_metadata"
  ) {
    findings.push("final release governance gate final safety gate misaligned with ultimate governance review summary");
  }
  if (boundary.boundarySourceLayer !== FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER) {
    findings.push(`boundary.boundarySourceLayer must be ${FINAL_ORCHESTRATION_READINESS_BOUNDARY_SOURCE_LAYER}`);
  }
  if (boundary.boundaryTargetLayer !== FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER) {
    findings.push(`boundary.boundaryTargetLayer must be ${FINAL_ORCHESTRATION_READINESS_BOUNDARY_TARGET_LAYER}`);
  }
  if (!boundaryForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual orchestration")) {
    findings.push("forbiddenBoundaryOperations missing actual orchestration");
  }
  if (!boundaryForbiddenIncludes(boundary.forbiddenBoundaryOperations, "actual execution")) {
    findings.push("forbiddenBoundaryOperations missing actual execution");
  }
  if (!inputEnvelope.envelopeRows.some((r) => r.includes("runtimeFinalReleaseGovernanceGateFinalSafetyGate"))) {
    findings.push("input envelope misaligned with final release governance gate final safety gate");
  }
  if (!outputEnvelope.envelopeRows.some((r) => r.includes("ultimateNoEnforcementProof"))) {
    findings.push("output envelope missing no-enforcement proof metadata");
  }
  if (!outputEnvelope.envelopeRows.some((r) => r.includes("orchestrationForbiddenProof"))) {
    findings.push("output envelope missing forbidden proof metadata");
  }
  if (!isRuntimeUltimateNoEnforcementProofValid(noEnforcementProof)) {
    findings.push("ultimate no-enforcement proof misaligned with actual false flags");
  }
  if (!isRuntimeOrchestrationForbiddenProofComplete(forbiddenProof)) {
    findings.push("orchestration-forbidden proof misaligned with forbidden boundary operations");
  }
  if (!checklist.checklist.some((r) => r.includes("ultimate no-enforcement proof diagnosticOnly"))) {
    findings.push("readiness checklist misaligned with no-enforcement proof");
  }
  if (!checklist.checklist.some((r) => r.includes("orchestration-forbidden proof complete"))) {
    findings.push("readiness checklist misaligned with forbidden proof");
  }
  if (!ultimateGovernanceBlockersAligned(blockerReport.blockers, summary.reviewBlockers)) {
    findings.push("blocker report misaligned with summary.reviewBlockers");
  }
  if (
    summary.reviewStatus === "ultimate_governance_metadata_ready" &&
    (boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.proofViolations.length > 0 ||
      boundaryViolation.wordingRiskFindings.length > 0)
  ) {
    findings.push("ultimate_governance_metadata_ready requires empty ultimate governance violations");
  }

  const alignmentStatus = resolveUltimateGovernanceReviewAlignmentStatus(findings);

  return {
    mode: "runtime_ultimate_governance_review_alignment_report",
    ...RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ACTUAL_FLAGS_DISABLED,
    alignmentStatus,
    findings: mergeSortedUniqueKo(findings),
    recommendations: mergeSortedUniqueKo([
      ...(alignmentStatus === "aligned_metadata"
        ? ["H40.5: ultimate governance review alignment aligned_metadata — H41 entry 후보(orchestration 없음)"]
        : []),
      ...(alignmentStatus === "partial"
        ? ["H40.5: ultimate governance review alignment partial — boundary·envelope·checklist rows 재검토"]
        : []),
      ...(alignmentStatus === "failed"
        ? ["H40.5: ultimate governance review alignment failed — violation·final gate 정렬"]
        : []),
    ]),
  };
}
