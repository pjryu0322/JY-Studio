/**
 * H38 / H38.5 — Overlay runtime **governance release-readiness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildGovernanceReleaseReadinessViolationRows } from "@/lib/harness/runtimeGovernanceReleaseReadiness/runtimeGovernanceReleaseReadinessCheckHelpers";
import {
  RUNTIME_GOVERNANCE_RELEASE_READINESS_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_MODE_LABEL_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_SECTION_DISCLAIMER_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_STATUS_LABEL_KO,
  RUNTIME_GOVERNANCE_RELEASE_READINESS_VERIFICATION_STATUS_LABEL_KO,
} from "@/lib/harness/runtimeGovernanceReleaseReadiness/runtimeGovernanceReleaseReadinessLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeGovernanceReleaseReadinessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  readinessStatusKo: string;
  readinessModeKo: string;
  finalGateStatusKo: string;
  h39EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topReleaseBlocker: string | null;
  topForbiddenBoundaryOperation: string | null;
  topReleaseReadinessViolation: string | null;
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
  const boundaryViolation = reports.runtimeGovernanceReleaseReadinessViolationReport;
  const readinessVerification = reports.runtimeGovernanceReleaseReadinessVerificationReport;
  const alignment = reports.runtimeGovernanceReleaseReadinessAlignmentReport;
  const finalGate = reports.runtimeGovernanceReleaseReadinessFinalSafetyGate;

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
  const boundaryViolationRows = buildGovernanceReleaseReadinessViolationRows(boundaryViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const releaseBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.readinessBlockers, ...finalGate.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.readinessBlockers, ...finalGate.blockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topReleaseBlocker =
    blockers.blockers[0] ?? summary.readinessBlockers[0] ?? checklist.blockers[0] ?? finalGate.blockers[0] ?? null;
  const topForbiddenBoundaryOperation = boundary.forbiddenBoundaryOperations[0] ?? null;
  const topReleaseReadinessViolation =
    boundaryViolation.actualFlagViolations[0] ??
    boundaryViolation.proofViolations[0] ??
    boundaryViolation.wordingRiskFindings[0] ??
    null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topReleaseReadinessViolation ?? topReleaseBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

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
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      boundaryViolation.proofViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      noEnforcementProof.diagnosticOnly !== true,
    showDetailSections: !compactAndNarrowUi,
    readinessStatusKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_STATUS_LABEL_KO[summary.readinessStatus],
    readinessModeKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_MODE_LABEL_KO[summary.readinessMode],
    finalGateStatusKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h39EntryReadinessKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_FINAL_GATE_STATUS_LABEL_KO[finalGate.h39EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_GOVERNANCE_RELEASE_READINESS_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_GOVERNANCE_RELEASE_READINESS_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topReleaseBlocker,
    topForbiddenBoundaryOperation,
    topReleaseReadinessViolation,
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
    releaseBlockerRows,
    recommendationRows,
  };
}
