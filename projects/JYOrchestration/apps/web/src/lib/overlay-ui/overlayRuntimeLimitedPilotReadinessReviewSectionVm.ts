/**
 * H43 — Overlay runtime **limited pilot readiness review** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_MODE_LABEL_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeLimitedPilotReadinessReviewSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  reviewStatusKo: string;
  reviewModeKo: string;
  topReadinessBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topBlockerOrForbidden: string | null;
  contractHardeningBoundarySummaryKo: string;
  inputEnvelopeSummaryKo: string;
  outputEnvelopeSummaryKo: string;
  noExecutionProofSummaryKo: string;
  forbiddenProofSummaryKo: string;
  contractBoundaryRows: readonly string[];
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  noExecutionProofRows: readonly string[];
  forbiddenProofRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  readinessBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeLimitedPilotReadinessReviewSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeLimitedPilotReadinessReviewSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeLimitedPilotReadinessReviewSummary;
  const boundary = reports.runtimePilotContractHardeningBoundary;
  const inputEnvelope = reports.runtimePilotReadinessInputEnvelope;
  const outputEnvelope = reports.runtimePilotReadinessOutputEnvelope;
  const noExecutionProof = reports.runtimePilotNoExecutionProof;
  const forbiddenProof = reports.runtimePilotExecutionForbiddenProof;
  const blockers = reports.runtimePilotReadinessBlockerReport;
  const checklist = reports.runtimePilotContractReadinessChecklist;

  const contractBoundaryRows = compactAndNarrowUi
    ? [boundary.boundarySourceLayer].slice(0, 1)
    : [
        `source: ${boundary.boundarySourceLayer}`,
        `target: ${boundary.boundaryTargetLayer}`,
        ...boundary.requiredBoundaryInputs.slice(0, 2),
      ];
  const forbiddenBoundaryRows = sliceOverlayRows(boundary.forbiddenBoundaryOperations, compactAndNarrowUi);
  const inputEnvelopeRows = sliceOverlayRows(inputEnvelope.envelopeRows, compactAndNarrowUi);
  const outputEnvelopeRows = sliceOverlayRows(outputEnvelope.envelopeRows, compactAndNarrowUi);
  const noExecutionProofRows = sliceOverlayRows(noExecutionProof.proofRows, compactAndNarrowUi);
  const forbiddenProofRows = sliceOverlayRows(forbiddenProof.proofRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const readinessBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.reviewBlockers, ...checklist.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.reviewBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topReadinessBlocker =
    summary.reviewBlockers[0] ?? blockers.blockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = forbiddenBoundaryRows[0] ?? null;
  const topBlockerOrForbidden = topReadinessBlocker ?? topForbiddenBoundaryOperation;

  return {
    sectionDisclaimer: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.reviewStatus === "blocked" ||
      summary.reviewStatus === "watch" ||
      topBlockerOrForbidden !== null,
    showDetailSections: !compactAndNarrowUi,
    reviewStatusKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_STATUS_LABEL_KO[summary.reviewStatus],
    reviewModeKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_MODE_LABEL_KO[summary.reviewMode],
    topReadinessBlocker,
    topForbiddenBoundaryOperation,
    topBlockerOrForbidden,
    contractHardeningBoundarySummaryKo: `${boundary.boundarySourceLayer} → ${boundary.boundaryTargetLayer}`,
    inputEnvelopeSummaryKo: `rows:${inputEnvelope.envelopeRows.length}`,
    outputEnvelopeSummaryKo: `rows:${outputEnvelope.envelopeRows.length}`,
    noExecutionProofSummaryKo: noExecutionProof.diagnosticOnly ? "diagnosticOnly" : "not diagnosticOnly",
    forbiddenProofSummaryKo: forbiddenProof.actualPilotActivationForbidden
      ? "pilot activation forbidden"
      : "incomplete",
    contractBoundaryRows,
    inputEnvelopeRows,
    outputEnvelopeRows,
    noExecutionProofRows,
    forbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    readinessBlockerRows,
    recommendationRows,
  };
}
