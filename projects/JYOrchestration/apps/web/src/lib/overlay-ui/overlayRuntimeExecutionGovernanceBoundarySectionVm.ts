/**
 * H37 — Overlay runtime **execution governance boundary** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";
import {
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_HARDENING_READINESS_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_MODE_LABEL_KO,
  RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeExecutionGovernanceBoundary/runtimeExecutionGovernanceBoundaryLabelsKo";

export type OverlayRuntimeExecutionGovernanceBoundarySectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  governanceModeKo: string;
  hardeningReadinessKo: string;
  topGovernanceBlocker: string | null;
  topForbiddenGovernanceOperation: string | null;
  topViolationOrBlocker: string | null;
  governancePolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenGovernanceOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
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
  const governanceBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.governanceBlockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.governanceBlockers]);
  const recommendationRows = compactAndNarrowUi
    ? summary.recommendations.slice(0, 1)
    : [...summary.recommendations];

  const topGovernanceBlocker =
    blockers.blockers[0] ?? summary.governanceBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenGovernanceOperation = scope.forbiddenGovernanceOperations[0] ?? null;
  const topViolationOrBlocker = topGovernanceBlocker ?? topForbiddenGovernanceOperation;

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
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      !policy.actualExecutionForbidden ||
      !policy.actualExecutionRoutingForbidden ||
      !policy.actualApprovalEnforcementForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    governanceModeKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_MODE_LABEL_KO[summary.governanceMode],
    hardeningReadinessKo: RUNTIME_EXECUTION_GOVERNANCE_BOUNDARY_HARDENING_READINESS_LABEL_KO[summary.hardeningReadiness],
    topGovernanceBlocker,
    topForbiddenGovernanceOperation,
    topViolationOrBlocker,
    governancePolicySummaryKo,
    scopeSummaryRows,
    forbiddenGovernanceOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    governanceBlockerRows,
    recommendationRows,
  };
}
