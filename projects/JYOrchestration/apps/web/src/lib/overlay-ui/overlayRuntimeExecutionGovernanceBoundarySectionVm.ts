/**
 * H37 / H37.5 — Overlay runtime **execution governance boundary** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildGovernanceBoundaryViolationRows } from "@/lib/harness/runtimeExecutionGovernanceBoundary/runtimeExecutionGovernanceBoundaryCheckHelpers";
import {
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_HARDENING_READINESS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_MODE_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_READINESS_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeExecutionGovernanceBoundary/runtimeExecutionGovernanceBoundaryLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeExecutionGovernanceBoundarySectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  governanceModeKo: string;
  hardeningReadinessKo: string;
  finalGateStatusKo: string;
  h38EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topGovernanceBlocker: string | null;
  topForbiddenGovernanceOperation: string | null;
  topBoundaryViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  governancePolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenGovernanceOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  governanceBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeExecutionGovernanceBoundarySectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeExecutionGovernanceBoundarySectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeExecutionGovernanceBoundarySummary;
  const scope = reports.runtimeExecutionGovernanceBoundaryScope;
  const policy = reports.runtimeExecutionGovernanceBoundaryPolicy;
  const blockers = reports.runtimeExecutionGovernanceBoundaryBlockerReport;
  const checklist = reports.runtimeExecutionGovernanceBoundaryReadinessChecklist;
  const boundaryViolation = reports.runtimeExecutionGovernanceBoundaryViolationReport;
  const readinessVerification = reports.runtimeExecutionGovernanceBoundaryReadinessVerificationReport;
  const alignment = reports.runtimeExecutionGovernanceBoundaryAlignmentReport;
  const finalGate = reports.runtimeExecutionGovernanceBoundaryFinalSafetyGate;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenGovernanceOperationRows = sliceOverlayRows(scope.forbiddenGovernanceOperations, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const boundaryViolationRows = buildGovernanceBoundaryViolationRows(boundaryViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const governanceBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.governanceBlockers, ...finalGate.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.governanceBlockers, ...finalGate.blockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topGovernanceBlocker =
    blockers.blockers[0] ??
    summary.governanceBlockers[0] ??
    checklist.blockers[0] ??
    finalGate.blockers[0] ??
    null;
  const topForbiddenGovernanceOperation = scope.forbiddenGovernanceOperations[0] ?? null;
  const topBoundaryViolation =
    boundaryViolation.actualFlagViolations[0] ?? boundaryViolation.wordingRiskFindings[0] ?? null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topBoundaryViolation ?? topGovernanceBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const governancePolicySummaryKo = [
    `allowedMode: ${RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_MODE_LABEL_KO[policy.governanceAllowedMode]}`,
    policy.operatorReviewBeforeGovernanceBoundary ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualExecutionForbidden: true",
    "actualExecutionRoutingForbidden: true",
    "actualReleaseEnforcementForbidden: true",
    "actualApprovalEnforcementForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "governance_boundary_metadata_candidate" ||
      summary.governanceMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      !policy.actualExecutionForbidden ||
      !policy.actualExecutionRoutingForbidden ||
      !policy.actualApprovalEnforcementForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    governanceModeKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_MODE_LABEL_KO[summary.governanceMode],
    hardeningReadinessKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_HARDENING_READINESS_LABEL_KO[summary.hardeningReadiness],
    finalGateStatusKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h38EntryReadinessKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_FINAL_GATE_STATUS_LABEL_KO[finalGate.h38EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_READINESS_VERIFICATION_STATUS_LABEL_KO[
        readinessVerification.verificationStatus
      ],
    alignmentStatusKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topGovernanceBlocker,
    topForbiddenGovernanceOperation,
    topBoundaryViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    governancePolicySummaryKo,
    scopeSummaryRows,
    forbiddenGovernanceOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    governanceBlockerRows,
    recommendationRows,
  };
}
