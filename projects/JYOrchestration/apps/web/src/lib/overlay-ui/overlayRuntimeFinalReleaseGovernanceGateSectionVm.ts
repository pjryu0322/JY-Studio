/**
 * H39 / H39.5 — Overlay runtime **final release governance gate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildFinalReleaseGovernanceGateViolationRows } from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateCheckHelpers";
import {
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_VERIFICATION_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeFinalReleaseGovernanceGateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  gateModeKo: string;
  finalGateStatusKo: string;
  h40EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topGateBlocker: string | null;
  topForbiddenGateOperation: string | null;
  topFinalGateViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  gatePolicySummaryKo: string;
  gateScopeSummaryRows: readonly string[];
  forbiddenGateOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  gateBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeFinalReleaseGovernanceGateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeFinalReleaseGovernanceGateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeFinalReleaseGovernanceGateSummary;
  const scope = reports.runtimeFinalReleaseGovernanceGateScope;
  const policy = reports.runtimeFinalReleaseGovernanceGatePolicy;
  const blockers = reports.runtimeFinalReleaseGovernanceGateBlockerReport;
  const checklist = reports.runtimeFinalReleaseGovernanceGateReadinessChecklist;
  const boundaryViolation = reports.runtimeFinalReleaseGovernanceGateViolationReport;
  const readinessVerification = reports.runtimeFinalReleaseGovernanceGateVerificationReport;
  const alignment = reports.runtimeFinalReleaseGovernanceGateAlignmentReport;
  const finalGate = reports.runtimeFinalReleaseGovernanceGateFinalSafetyGate;

  const gateScopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenGateOperationRows = sliceOverlayRows(scope.forbiddenGateOperations, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const boundaryViolationRows = buildFinalReleaseGovernanceGateViolationRows(boundaryViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const gateBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.gateBlockers, ...finalGate.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.gateBlockers, ...finalGate.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topGateBlocker =
    blockers.blockers[0] ?? summary.gateBlockers[0] ?? checklist.blockers[0] ?? finalGate.blockers[0] ?? null;
  const topForbiddenGateOperation = scope.forbiddenGateOperations[0] ?? null;
  const topFinalGateViolation =
    boundaryViolation.actualFlagViolations[0] ?? boundaryViolation.wordingRiskFindings[0] ?? null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topFinalGateViolation ?? topGateBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const gatePolicySummaryKo = [
    `allowedMode: ${RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO[policy.gateAllowedMode]}`,
    policy.operatorReviewBeforeFinalReleaseGate ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualExecutionForbidden: true",
    "actualExecutionBlockingForbidden: true",
    "actualMergeBlockingForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "final_release_governance_gate_metadata_candidate" ||
      summary.gateMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      !policy.actualExecutionForbidden ||
      !policy.actualExecutionRoutingForbidden ||
      !policy.actualReleaseEnforcementForbidden ||
      !policy.actualApprovalEnforcementForbidden ||
      !policy.actualExecutionBlockingForbidden ||
      !policy.actualMergeBlockingForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    gateModeKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO[summary.gateMode],
    finalGateStatusKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h40EntryReadinessKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_FINAL_GATE_STATUS_LABEL_KO[finalGate.h40EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topGateBlocker,
    topForbiddenGateOperation,
    topFinalGateViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    gatePolicySummaryKo,
    gateScopeSummaryRows,
    forbiddenGateOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    gateBlockerRows,
    recommendationRows,
  };
}
