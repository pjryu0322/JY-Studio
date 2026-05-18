/**
 * H44 / H44.5 — Overlay runtime **pilot execution readiness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildPilotExecutionReadinessViolationRows } from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessCheckHelpers";
import {
  RUNTIME_PILOT_EXECUTION_READINESS_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_MODE_LABEL_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_STATUS_LABEL_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_VERIFICATION_STATUS_LABEL_KO,
} from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimePilotExecutionReadinessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  readinessStatusKo: string;
  readinessModeKo: string;
  finalGateStatusKo: string;
  h45EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topReadinessBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topExecutionReadinessViolation: string | null;
  topVerificationFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  executionReadinessBoundarySummaryKo: string;
  inputEnvelopeSummaryKo: string;
  outputEnvelopeSummaryKo: string;
  finalNoExecutionProofSummaryKo: string;
  finalForbiddenProofSummaryKo: string;
  boundaryRows: readonly string[];
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  executionReadinessViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  finalNoExecutionProofRows: readonly string[];
  finalForbiddenProofRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  readinessBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimePilotExecutionReadinessSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimePilotExecutionReadinessSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimePilotExecutionReadinessSummary;
  const boundary = reports.runtimePilotExecutionReadinessBoundary;
  const inputEnvelope = reports.runtimePilotExecutionReadinessInputEnvelope;
  const outputEnvelope = reports.runtimePilotExecutionReadinessOutputEnvelope;
  const blockers = reports.runtimePilotExecutionReadinessBlockerReport;
  const checklist = reports.runtimePilotExecutionReadinessChecklist;
  const executionViolation = reports.runtimePilotExecutionReadinessViolationReport;
  const readinessVerification = reports.runtimePilotExecutionReadinessVerificationReport;
  const alignment = reports.runtimePilotExecutionReadinessAlignmentReport;
  const finalGate = reports.runtimePilotExecutionReadinessFinalSafetyGate;
  const noExecutionProof = reports.runtimeFinalPilotNoExecutionProof;
  const forbiddenProof = reports.runtimeFinalPilotExecutionForbiddenProof;

  const boundaryRows = compactAndNarrowUi
    ? [boundary.boundarySourceLayer].slice(0, 1)
    : [
        `source: ${boundary.boundarySourceLayer}`,
        `target: ${boundary.boundaryTargetLayer}`,
        ...boundary.requiredBoundaryInputs.slice(0, 2),
      ];
  const forbiddenBoundaryRows = sliceOverlayRows(boundary.forbiddenBoundaryOperations, compactAndNarrowUi);
  const inputEnvelopeRows = sliceOverlayRows(inputEnvelope.envelopeRows, compactAndNarrowUi);
  const outputEnvelopeRows = sliceOverlayRows(outputEnvelope.envelopeRows, compactAndNarrowUi);
  const executionReadinessViolationRows = buildPilotExecutionReadinessViolationRows(
    executionViolation,
    compactAndNarrowUi
  );
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const finalNoExecutionProofRows = sliceOverlayRows(noExecutionProof.proofRows, compactAndNarrowUi);
  const finalForbiddenProofRows = sliceOverlayRows(forbiddenProof.proofRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const readinessBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.readinessBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.readinessBlockers,
        ...checklist.blockers,
        ...finalGate.blockers,
      ]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topReadinessBlocker =
    summary.readinessBlockers[0] ?? blockers.blockers[0] ?? checklist.blockers[0] ?? finalGate.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = forbiddenBoundaryRows[0] ?? null;
  const topExecutionReadinessViolation =
    executionViolation.actualFlagViolations[0] ??
    executionViolation.proofViolations[0] ??
    executionViolation.forbiddenProofViolations[0] ??
    executionViolation.wordingRiskFindings[0] ??
    null;
  const topVerificationFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topExecutionReadinessViolation ?? topReadinessBlocker ?? topVerificationFinding ?? topAlignmentFinding ?? null;

  return {
    sectionDisclaimer: RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.readinessStatus === "blocked" ||
      summary.readinessStatus === "watch" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      topViolationOrBlocker !== null,
    showDetailSections: !compactAndNarrowUi,
    readinessStatusKo: RUNTIME_PILOT_EXECUTION_READINESS_STATUS_LABEL_KO[summary.readinessStatus],
    readinessModeKo: RUNTIME_PILOT_EXECUTION_READINESS_MODE_LABEL_KO[summary.readinessMode],
    finalGateStatusKo: RUNTIME_PILOT_EXECUTION_READINESS_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h45EntryReadinessKo: RUNTIME_PILOT_EXECUTION_READINESS_FINAL_GATE_STATUS_LABEL_KO[finalGate.h45EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_PILOT_EXECUTION_READINESS_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_PILOT_EXECUTION_READINESS_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topReadinessBlocker,
    topForbiddenBoundaryOperation,
    topExecutionReadinessViolation,
    topVerificationFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    executionReadinessBoundarySummaryKo: `${boundary.boundarySourceLayer} → ${boundary.boundaryTargetLayer}`,
    inputEnvelopeSummaryKo: `rows:${inputEnvelope.envelopeRows.length}`,
    outputEnvelopeSummaryKo: `rows:${outputEnvelope.envelopeRows.length}`,
    finalNoExecutionProofSummaryKo: noExecutionProof.diagnosticOnly ? "diagnosticOnly" : "not diagnosticOnly",
    finalForbiddenProofSummaryKo: forbiddenProof.actualPilotActivationForbidden
      ? "pilot activation forbidden"
      : "incomplete",
    boundaryRows,
    inputEnvelopeRows,
    outputEnvelopeRows,
    executionReadinessViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    finalNoExecutionProofRows,
    finalForbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    readinessBlockerRows,
    recommendationRows,
  };
}
