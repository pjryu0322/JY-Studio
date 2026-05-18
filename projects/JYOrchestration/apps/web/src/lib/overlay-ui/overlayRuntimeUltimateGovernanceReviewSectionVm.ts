/**
 * H40 / H40.5 — Overlay runtime **ultimate governance review** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildUltimateGovernanceReviewViolationRows } from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewCheckHelpers";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_MODE_LABEL_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_SECTION_DISCLAIMER_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_STATUS_LABEL_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_VERIFICATION_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";

export type OverlayRuntimeUltimateGovernanceReviewSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  reviewStatusKo: string;
  reviewModeKo: string;
  finalGateStatusKo: string;
  h41EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topReviewBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topUltimateGovernanceViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  boundarySummaryKo: string;
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  forbiddenBoundaryOperationRows: readonly string[];
  noEnforcementProofRows: readonly string[];
  forbiddenProofRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  reviewBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeUltimateGovernanceReviewSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeUltimateGovernanceReviewSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeUltimateGovernanceReviewSummary;
  const boundary = reports.runtimeFinalOrchestrationReadinessBoundary;
  const inputEnvelope = reports.runtimeOrchestrationReadinessInputEnvelope;
  const outputEnvelope = reports.runtimeOrchestrationReadinessOutputEnvelope;
  const noEnforcementProof = reports.runtimeUltimateNoEnforcementProof;
  const forbiddenProof = reports.runtimeOrchestrationForbiddenProof;
  const blockers = reports.runtimeUltimateGovernanceBlockerReport;
  const checklist = reports.runtimeFinalOrchestrationReadinessChecklist;
  const boundaryViolation = reports.runtimeUltimateGovernanceReviewViolationReport;
  const readinessVerification = reports.runtimeUltimateGovernanceReviewVerificationReport;
  const alignment = reports.runtimeUltimateGovernanceReviewAlignmentReport;
  const finalGate = reports.runtimeUltimateGovernanceReviewFinalSafetyGate;

  const inputEnvelopeRows = sliceOverlayRows(inputEnvelope.envelopeRows, compactAndNarrowUi);
  const outputEnvelopeRows = sliceOverlayRows(outputEnvelope.envelopeRows, compactAndNarrowUi);
  const forbiddenBoundaryOperationRows = sliceOverlayRows(
    boundary.forbiddenBoundaryOperations,
    compactAndNarrowUi
  );
  const noEnforcementProofRows = sliceOverlayRows(noEnforcementProof.proofRows, compactAndNarrowUi);
  const forbiddenProofRows = sliceOverlayRows(forbiddenProof.proofRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const boundaryViolationRows = buildUltimateGovernanceReviewViolationRows(boundaryViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const reviewBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.reviewBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.reviewBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topReviewBlocker =
    blockers.blockers[0] ??
    summary.reviewBlockers[0] ??
    checklist.blockers[0] ??
    finalGate.blockers[0] ??
    null;
  const topForbiddenBoundaryOperation = boundary.forbiddenBoundaryOperations[0] ?? null;
  const topUltimateGovernanceViolation =
    boundaryViolation.actualFlagViolations[0] ??
    boundaryViolation.proofViolations[0] ??
    boundaryViolation.wordingRiskFindings[0] ??
    null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topUltimateGovernanceViolation ?? topReviewBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const boundarySummaryKo = compactAndNarrowUi
    ? boundary.boundarySourceLayer
    : [
        `source: ${boundary.boundarySourceLayer}`,
        `target: ${boundary.boundaryTargetLayer}`,
        `scopes: ${boundary.allowedBoundaryScopes.length}`,
      ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.reviewStatus !== "ultimate_governance_metadata_ready" ||
      summary.reviewMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.proofViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      noEnforcementProof.diagnosticOnly !== true ||
      forbiddenProof.actualOrchestrationForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    reviewStatusKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_STATUS_LABEL_KO[summary.reviewStatus],
    reviewModeKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_MODE_LABEL_KO[summary.reviewMode],
    finalGateStatusKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h41EntryReadinessKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_FINAL_GATE_STATUS_LABEL_KO[finalGate.h41EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topReviewBlocker,
    topForbiddenBoundaryOperation,
    topUltimateGovernanceViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    boundarySummaryKo,
    inputEnvelopeRows,
    outputEnvelopeRows,
    forbiddenBoundaryOperationRows,
    noEnforcementProofRows,
    forbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    reviewBlockerRows,
    recommendationRows,
  };
}
