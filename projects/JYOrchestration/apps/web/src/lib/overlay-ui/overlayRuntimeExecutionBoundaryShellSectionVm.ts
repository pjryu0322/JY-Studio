/**
 * H36 — Overlay runtime **execution boundary metadata shell** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import {
  RUNTIME_EXECUTION_BOUNDARY_SHELL_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_MODE_LABEL_KO,
  RUNTIME_EXECUTION_BOUNDARY_SHELL_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeExecutionBoundaryShell/runtimeExecutionBoundaryShellLabelsKo";

export type OverlayRuntimeExecutionBoundaryShellSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  shellModeKo: string;
  topShellBlocker: string | null;
  topForbiddenShellOperation: string | null;
  topViolationOrBlocker: string | null;
  shellPolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenShellOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
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
  const shellBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.shellBlockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.shellBlockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topShellBlocker =
    blockers.blockers[0] ?? summary.shellBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenShellOperation = scope.forbiddenShellOperations[0] ?? null;
  const topViolationOrBlocker = topShellBlocker ?? topForbiddenShellOperation;

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
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      !policy.actualExecutionForbidden ||
      !policy.actualExecutionRoutingForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    shellModeKo: RUNTIME_EXECUTION_BOUNDARY_SHELL_MODE_LABEL_KO[summary.shellMode],
    topShellBlocker,
    topForbiddenShellOperation,
    topViolationOrBlocker,
    shellPolicySummaryKo,
    scopeSummaryRows,
    forbiddenShellOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    shellBlockerRows,
    recommendationRows,
  };
}
