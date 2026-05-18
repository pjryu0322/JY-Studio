/**
 * H43 / H43.5 — Overlay runtime **limited pilot readiness review** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildPilotReadinessReviewViolationRows } from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewCheckHelpers";
import {
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_MODE_LABEL_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_STATUS_LABEL_KO,
  RUNTIME_LIMITED_PILOT_READINESS_REVIEW_VERIFICATION_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeLimitedPilotReadinessReview/runtimeLimitedPilotReadinessReviewLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeLimitedPilotReadinessReviewSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  reviewStatusKo: string;
  reviewModeKo: string;
  finalGateStatusKo: string;
  h44EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topReadinessBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topPilotReadinessViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  contractHardeningBoundarySummaryKo: string;
  inputEnvelopeSummaryKo: string;
  outputEnvelopeSummaryKo: string;
  noExecutionProofSummaryKo: string;
  forbiddenProofSummaryKo: string;
  contractBoundaryRows: readonly string[];
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  readinessViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
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
  const blockers = reports.runtimePilotReadinessBlockerReport;
  const checklist = reports.runtimePilotContractReadinessChecklist;
  const reviewViolation = reports.runtimeLimitedPilotReadinessReviewViolationReport;
  const readinessVerification = reports.runtimeLimitedPilotReadinessReviewVerificationReport;
  const alignment = reports.runtimeLimitedPilotReadinessReviewAlignmentReport;
  const finalGate = reports.runtimeLimitedPilotReadinessReviewFinalSafetyGate;
  const noExecutionProof = reports.runtimePilotNoExecutionProof;
  const forbiddenProof = reports.runtimePilotExecutionForbiddenProof;

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
  const readinessViolationRows = buildPilotReadinessReviewViolationRows(reviewViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const noExecutionProofRows = sliceOverlayRows(noExecutionProof.proofRows, compactAndNarrowUi);
  const forbiddenProofRows = sliceOverlayRows(forbiddenProof.proofRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const readinessBlockerRows = compactAndNarrowUi
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

  const topReadinessBlocker =
    summary.reviewBlockers[0] ?? blockers.blockers[0] ?? checklist.blockers[0] ?? finalGate.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = forbiddenBoundaryRows[0] ?? null;
  const topPilotReadinessViolation =
    reviewViolation.actualFlagViolations[0] ??
    reviewViolation.proofViolations[0] ??
    reviewViolation.forbiddenProofViolations[0] ??
    reviewViolation.wordingRiskFindings[0] ??
    null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topPilotReadinessViolation ?? topReadinessBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  return {
    sectionDisclaimer: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.reviewStatus === "blocked" ||
      summary.reviewStatus === "watch" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      topViolationOrBlocker !== null,
    showDetailSections: !compactAndNarrowUi,
    reviewStatusKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_STATUS_LABEL_KO[summary.reviewStatus],
    reviewModeKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_MODE_LABEL_KO[summary.reviewMode],
    finalGateStatusKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h44EntryReadinessKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_FINAL_GATE_STATUS_LABEL_KO[finalGate.h44EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_LIMITED_PILOT_READINESS_REVIEW_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_LIMITED_PILOT_READINESS_REVIEW_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topReadinessBlocker,
    topForbiddenBoundaryOperation,
    topPilotReadinessViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
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
    readinessViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    noExecutionProofRows,
    forbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    readinessBlockerRows,
    recommendationRows,
  };
}
