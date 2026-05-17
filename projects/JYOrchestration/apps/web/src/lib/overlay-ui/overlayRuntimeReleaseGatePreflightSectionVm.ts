/**
 * H35 / H35.5 — Overlay runtime **release-gate final preflight** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  buildPreflightBoundaryViolationRows,
  sliceOverlayRows,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import {
  RUNTIME_RELEASE_GATE_PREFLIGHT_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_MODE_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightLabelsKo";

export type OverlayRuntimeReleaseGatePreflightSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  preflightReadinessKo: string;
  preflightModeKo: string;
  finalGateStatusKo: string;
  h36EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topPreflightBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topBoundaryViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  boundarySummaryKo: string;
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  forbiddenBoundaryOperationRows: readonly string[];
  noExecutionProofRows: readonly string[];
  operationForbiddenProofRows: readonly string[];
  preflightChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  preflightBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeReleaseGatePreflightSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeReleaseGatePreflightSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeReleaseGatePreflightSummary;
  const boundary = reports.runtimeReleaseGateExecutionReadinessBoundary;
  const inputEnvelope = reports.runtimeReleaseGateInputEnvelope;
  const outputEnvelope = reports.runtimeReleaseGateOutputEnvelope;
  const noExecutionProof = reports.runtimeReleaseGateNoExecutionProof;
  const operationForbiddenProof = reports.runtimeReleaseGateOperationForbiddenProof;
  const blockers = reports.runtimeReleaseGatePreflightBlockerReport;
  const checklist = reports.runtimeReleaseGatePreflightChecklist;
  const boundaryViolation = reports.runtimeReleaseGatePreflightBoundaryViolationReport;
  const readinessVerification = reports.runtimeReleaseGatePreflightReadinessVerificationReport;
  const alignment = reports.runtimeReleaseGatePreflightAlignmentReport;
  const finalGate = reports.runtimeReleaseGatePreflightFinalSafetyGate;

  const inputEnvelopeRows = sliceOverlayRows(inputEnvelope.envelopeRows, compactAndNarrowUi);
  const outputEnvelopeRows = sliceOverlayRows(outputEnvelope.envelopeRows, compactAndNarrowUi);
  const forbiddenBoundaryOperationRows = sliceOverlayRows(
    boundary.forbiddenBoundaryOperations,
    compactAndNarrowUi
  );
  const noExecutionProofRows = sliceOverlayRows(noExecutionProof.proofRows, compactAndNarrowUi);
  const operationForbiddenProofRows = sliceOverlayRows(operationForbiddenProof.proofRows, compactAndNarrowUi);
  const preflightChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const boundaryViolationRows = buildPreflightBoundaryViolationRows(boundaryViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const preflightBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.preflightBlockers, ...finalGate.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.preflightBlockers, ...finalGate.blockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topPreflightBlocker =
    blockers.blockers[0] ?? summary.preflightBlockers[0] ?? checklist.blockers[0] ?? finalGate.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = boundary.forbiddenBoundaryOperations[0] ?? null;
  const topBoundaryViolation =
    boundaryViolation.actualFlagViolations[0] ??
    boundaryViolation.proofViolations[0] ??
    boundaryViolation.wordingRiskFindings[0] ??
    null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topBoundaryViolation ?? topPreflightBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const boundarySummaryKo = [
    `source: ${boundary.boundarySourceLayer}`,
    `target: ${boundary.boundaryTargetLayer}`,
    `scopes: ${boundary.allowedBoundaryScopes.length}`,
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_RELEASE_GATE_PREFLIGHT_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.preflightReadiness !== "preflight_metadata_ready" ||
      summary.preflightMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.proofViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      noExecutionProof.diagnosticOnly !== true,
    showDetailSections: !compactAndNarrowUi,
    preflightReadinessKo: RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_LABEL_KO[summary.preflightReadiness],
    preflightModeKo: RUNTIME_RELEASE_GATE_PREFLIGHT_MODE_LABEL_KO[summary.preflightMode],
    finalGateStatusKo: RUNTIME_RELEASE_GATE_PREFLIGHT_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h36EntryReadinessKo: RUNTIME_RELEASE_GATE_PREFLIGHT_FINAL_GATE_STATUS_LABEL_KO[finalGate.h36EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_RELEASE_GATE_PREFLIGHT_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topPreflightBlocker,
    topForbiddenBoundaryOperation,
    topBoundaryViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    boundarySummaryKo,
    inputEnvelopeRows,
    outputEnvelopeRows,
    forbiddenBoundaryOperationRows,
    noExecutionProofRows,
    operationForbiddenProofRows,
    preflightChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    preflightBlockerRows,
    recommendationRows,
  };
}
