/**
 * H36 / H36.5 — Overlay runtime **execution boundary metadata shell** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { buildShellBoundaryViolationRows } from "@/lib/harness/runtimeExecutionBoundaryShell/runtimeExecutionBoundaryShellCheckHelpers";
import {
  RUNTIME_EXECUTION_BOUNDARY_SHELL_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_MODE_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_READINESS_VERIFICATION_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeExecutionBoundaryShell/runtimeExecutionBoundaryShellLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeExecutionBoundaryShellSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  shellModeKo: string;
  finalGateStatusKo: string;
  h37EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topShellBlocker: string | null;
  topForbiddenShellOperation: string | null;
  topBoundaryViolation: string | null;
  topReadinessFinding: string | null;
  topAlignmentFinding: string | null;
  topViolationOrBlocker: string | null;
  shellPolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenShellOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
  shellBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeExecutionBoundaryShellSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeExecutionBoundaryShellSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeExecutionBoundaryShellSummary;
  const scope = reports.runtimeExecutionBoundaryShellScope;
  const policy = reports.runtimeExecutionBoundaryShellPolicy;
  const blockers = reports.runtimeExecutionBoundaryShellBlockerReport;
  const checklist = reports.runtimeExecutionBoundaryShellReadinessChecklist;
  const boundaryViolation = reports.runtimeExecutionBoundaryShellBoundaryViolationReport;
  const readinessVerification = reports.runtimeExecutionBoundaryShellReadinessVerificationReport;
  const alignment = reports.runtimeExecutionBoundaryShellAlignmentReport;
  const finalGate = reports.runtimeExecutionBoundaryShellFinalSafetyGate;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenShellOperationRows = sliceOverlayRows(scope.forbiddenShellOperations, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const boundaryViolationRows = buildShellBoundaryViolationRows(boundaryViolation, compactAndNarrowUi);
  const readinessFindingRows = sliceOverlayRows(readinessVerification.findings, compactAndNarrowUi);
  const alignmentFindingRows = sliceOverlayRows(alignment.findings, compactAndNarrowUi);
  const finalGateChecklistRows = sliceOverlayRows(finalGate.checklist, compactAndNarrowUi);
  const shellBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.shellBlockers, ...finalGate.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.shellBlockers, ...finalGate.blockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topShellBlocker =
    blockers.blockers[0] ??
    summary.shellBlockers[0] ??
    checklist.blockers[0] ??
    finalGate.blockers[0] ??
    null;
  const topForbiddenShellOperation = scope.forbiddenShellOperations[0] ?? null;
  const topBoundaryViolation =
    boundaryViolation.actualFlagViolations[0] ?? boundaryViolation.wordingRiskFindings[0] ?? null;
  const topReadinessFinding = readinessVerification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topBoundaryViolation ?? topShellBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? null;

  const shellPolicySummaryKo = [
    `allowedMode: ${RUNTIME_EXECUTION_BOUNDARY_SHELL_MODE_LABEL_KO[policy.shellAllowedMode]}`,
    policy.operatorReviewBeforeExecutionBoundary ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualExecutionForbidden: true",
    "actualExecutionRoutingForbidden: true",
    "actualReleaseEnforcementForbidden: true",
    "actualShellExecutionForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_EXECUTION_BOUNDARY_SHELL_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "boundary_shell_metadata_candidate" ||
      summary.shellMode === "blocked" ||
      finalGate.finalGateStatus !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundaryViolation.actualFlagViolations.length > 0 ||
      readinessVerification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      !policy.actualExecutionForbidden ||
      !policy.actualExecutionRoutingForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    shellModeKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_MODE_LABEL_KO[summary.shellMode],
    finalGateStatusKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_FINAL_GATE_STATUS_LABEL_KO[finalGate.finalGateStatus],
    h37EntryReadinessKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_FINAL_GATE_STATUS_LABEL_KO[finalGate.h37EntryReadiness],
    readinessVerificationStatusKo:
      RUNTIME_EXECUTION_BOUNDARY_SHELL_READINESS_VERIFICATION_STATUS_LABEL_KO[readinessVerification.verificationStatus],
    alignmentStatusKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topShellBlocker,
    topForbiddenShellOperation,
    topBoundaryViolation,
    topReadinessFinding,
    topAlignmentFinding,
    topViolationOrBlocker,
    shellPolicySummaryKo,
    scopeSummaryRows,
    forbiddenShellOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    boundaryViolationRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    shellBlockerRows,
    recommendationRows,
  };
}
