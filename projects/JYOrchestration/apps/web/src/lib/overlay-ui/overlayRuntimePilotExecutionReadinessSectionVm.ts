/**
 * H44 — Overlay runtime **pilot execution readiness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_PILOT_EXECUTION_READINESS_MODE_LABEL_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO,
  RUNTIME_PILOT_EXECUTION_READINESS_STATUS_LABEL_KO,
} from "@/lib/harness/runtimePilotExecutionReadiness/runtimePilotExecutionReadinessLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimePilotExecutionReadinessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  readinessStatusKo: string;
  readinessModeKo: string;
  topReadinessBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  executionReadinessBoundarySummaryKo: string;
  inputEnvelopeSummaryKo: string;
  outputEnvelopeSummaryKo: string;
  finalNoExecutionProofSummaryKo: string;
  finalForbiddenProofSummaryKo: string;
  boundaryRows: readonly string[];
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
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
  const finalNoExecutionProofRows = sliceOverlayRows(noExecutionProof.proofRows, compactAndNarrowUi);
  const finalForbiddenProofRows = sliceOverlayRows(forbiddenProof.proofRows, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const readinessBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([
        ...blockers.blockers,
        ...summary.readinessBlockers,
        ...checklist.blockers,
      ]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.readinessBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topReadinessBlocker =
    summary.readinessBlockers[0] ?? blockers.blockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = forbiddenBoundaryRows[0] ?? null;

  return {
    sectionDisclaimer: RUNTIME_PILOT_EXECUTION_READINESS_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.readinessStatus === "blocked" ||
      summary.readinessStatus === "watch" ||
      topReadinessBlocker !== null ||
      topForbiddenBoundaryOperation !== null,
    showDetailSections: !compactAndNarrowUi,
    readinessStatusKo: RUNTIME_PILOT_EXECUTION_READINESS_STATUS_LABEL_KO[summary.readinessStatus],
    readinessModeKo: RUNTIME_PILOT_EXECUTION_READINESS_MODE_LABEL_KO[summary.readinessMode],
    topReadinessBlocker,
    topForbiddenBoundaryOperation,
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
    finalNoExecutionProofRows,
    finalForbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    readinessBlockerRows,
    recommendationRows,
  };
}
