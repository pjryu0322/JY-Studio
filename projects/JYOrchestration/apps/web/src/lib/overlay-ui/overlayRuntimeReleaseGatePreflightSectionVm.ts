/**
 * H35 — Overlay runtime **release-gate final preflight** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RELEASE_GATE_PREFLIGHT_MODE_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_RELEASE_GATE_PREFLIGHT_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightLabelsKo";

export type OverlayRuntimeReleaseGatePreflightSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  preflightReadinessKo: string;
  preflightModeKo: string;
  topPreflightBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  boundarySummaryKo: string;
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  forbiddenBoundaryOperationRows: readonly string[];
  noExecutionProofRows: readonly string[];
  operationForbiddenProofRows: readonly string[];
  preflightChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
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

  const inputEnvelopeRows = compactAndNarrowUi
    ? inputEnvelope.envelopeRows.slice(0, 1)
    : [...inputEnvelope.envelopeRows];
  const outputEnvelopeRows = compactAndNarrowUi
    ? outputEnvelope.envelopeRows.slice(0, 1)
    : [...outputEnvelope.envelopeRows];
  const forbiddenBoundaryOperationRows = compactAndNarrowUi
    ? boundary.forbiddenBoundaryOperations.slice(0, 1)
    : [...boundary.forbiddenBoundaryOperations];
  const noExecutionProofRows = compactAndNarrowUi
    ? noExecutionProof.proofRows.slice(0, 1)
    : [...noExecutionProof.proofRows];
  const operationForbiddenProofRows = compactAndNarrowUi
    ? operationForbiddenProof.proofRows.slice(0, 1)
    : [...operationForbiddenProof.proofRows];
  const preflightChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const missingChecklistRows = compactAndNarrowUi
    ? checklist.missingRows.slice(0, 1)
    : [...checklist.missingRows];
  const preflightBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.preflightBlockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.preflightBlockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topPreflightBlocker =
    blockers.blockers[0] ?? summary.preflightBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = boundary.forbiddenBoundaryOperations[0] ?? null;

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
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      noExecutionProof.diagnosticOnly !== true,
    showDetailSections: !compactAndNarrowUi,
    preflightReadinessKo: RUNTIME_RELEASE_GATE_PREFLIGHT_READINESS_LABEL_KO[summary.preflightReadiness],
    preflightModeKo: RUNTIME_RELEASE_GATE_PREFLIGHT_MODE_LABEL_KO[summary.preflightMode],
    topPreflightBlocker,
    topForbiddenBoundaryOperation,
    boundarySummaryKo,
    inputEnvelopeRows,
    outputEnvelopeRows,
    forbiddenBoundaryOperationRows,
    noExecutionProofRows,
    operationForbiddenProofRows,
    preflightChecklistRows,
    missingChecklistRows,
    preflightBlockerRows,
    recommendationRows,
  };
}
