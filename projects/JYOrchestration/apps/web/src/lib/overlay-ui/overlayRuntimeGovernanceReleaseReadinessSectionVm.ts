/**
 * H38 — Overlay runtime **governance release-readiness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import {
  RUNTIME_GOVERNANCE_RELEASE_READINESS_MODE_LABEL_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_SECTION_DISCLAIMER_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeGovernanceReleaseReadiness/runtimeGovernanceReleaseReadinessLabelsKo";

export type OverlayRuntimeGovernanceReleaseReadinessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  readinessStatusKo: string;
  readinessModeKo: string;
  topReleaseBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topViolationOrBlocker: string | null;
  boundarySummaryKo: string;
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  forbiddenBoundaryOperationRows: readonly string[];
  noEnforcementProofRows: readonly string[];
  forbiddenProofRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  releaseBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeGovernanceReleaseReadinessSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeGovernanceReleaseReadinessSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeGovernanceReleaseReadinessSummary;
  const boundary = reports.runtimeGovernanceReleaseReadinessBoundary;
  const inputEnvelope = reports.runtimeGovernanceReleaseInputEnvelope;
  const outputEnvelope = reports.runtimeGovernanceReleaseOutputEnvelope;
  const noEnforcementProof = reports.runtimeGovernanceNoEnforcementProof;
  const forbiddenProof = reports.runtimeExecutionGovernanceForbiddenProof;
  const blockers = reports.runtimeGovernanceReleaseBlockerReport;
  const checklist = reports.runtimeGovernanceReleaseReadinessChecklist;

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
  const releaseBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.readinessBlockers, ...checklist.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.readinessBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topReleaseBlocker =
    blockers.blockers[0] ?? summary.readinessBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = boundary.forbiddenBoundaryOperations[0] ?? null;
  const topViolationOrBlocker = topReleaseBlocker ?? topForbiddenBoundaryOperation ?? null;

  const boundarySummaryKo = [
    `source: ${boundary.boundarySourceLayer}`,
    `target: ${boundary.boundaryTargetLayer}`,
    `scopes: ${boundary.allowedBoundaryScopes.length}`,
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_GOVERNANCE_RELEASE_READINESS_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.readinessStatus !== "governance_release_metadata_ready" ||
      summary.readinessMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      noEnforcementProof.diagnosticOnly !== true,
    showDetailSections: !compactAndNarrowUi,
    readinessStatusKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_STATUS_LABEL_KO[summary.readinessStatus],
    readinessModeKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_MODE_LABEL_KO[summary.readinessMode],
    topReleaseBlocker,
    topForbiddenBoundaryOperation,
    topViolationOrBlocker,
    boundarySummaryKo,
    inputEnvelopeRows,
    outputEnvelopeRows,
    forbiddenBoundaryOperationRows,
    noEnforcementProofRows,
    forbiddenProofRows,
    readinessChecklistRows,
    missingChecklistRows,
    releaseBlockerRows,
    recommendationRows,
  };
}
