/**
 * H40 — Overlay runtime **ultimate governance review** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_MODE_LABEL_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_SECTION_DISCLAIMER_KO,
  RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeUltimateGovernanceReview/runtimeUltimateGovernanceReviewLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";

export type OverlayRuntimeUltimateGovernanceReviewSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  reviewStatusKo: string;
  reviewModeKo: string;
  topReviewBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  boundarySummaryKo: string;
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  forbiddenBoundaryOperationRows: readonly string[];
  noEnforcementProofRows: readonly string[];
  forbiddenProofRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
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
  const reviewBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.reviewBlockers, ...checklist.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.reviewBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topReviewBlocker =
    blockers.blockers[0] ?? summary.reviewBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = boundary.forbiddenBoundaryOperations[0] ?? null;

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
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      noEnforcementProof.diagnosticOnly !== true ||
      forbiddenProof.actualOrchestrationForbidden !== true,
    showDetailSections: !compactAndNarrowUi,
    reviewStatusKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_STATUS_LABEL_KO[summary.reviewStatus],
    reviewModeKo: RUNTIME_ULTIMATE_GOVERNANCE_REVIEW_MODE_LABEL_KO[summary.reviewMode],
    topReviewBlocker,
    topForbiddenBoundaryOperation,
    boundarySummaryKo,
    inputEnvelopeRows,
    outputEnvelopeRows,
    forbiddenBoundaryOperationRows,
    noEnforcementProofRows,
    forbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    reviewBlockerRows,
    recommendationRows,
  };
}
