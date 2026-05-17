/**
 * H39 — Overlay runtime **final release governance gate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO,
  RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeFinalReleaseGovernanceGate/runtimeFinalReleaseGovernanceGateLabelsKo";
import { sliceOverlayRows } from "@/lib/harness/runtimeReleaseGatePreflight/runtimeReleaseGatePreflightCheckHelpers";

export type OverlayRuntimeFinalReleaseGovernanceGateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  gateModeKo: string;
  topGateBlocker: string | null;
  topForbiddenGateOperation: string | null;
  gatePolicySummaryKo: string;
  gateScopeSummaryRows: readonly string[];
  forbiddenGateOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  gateBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeFinalReleaseGovernanceGateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeFinalReleaseGovernanceGateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const summary = reports.runtimeFinalReleaseGovernanceGateSummary;
  const scope = reports.runtimeFinalReleaseGovernanceGateScope;
  const policy = reports.runtimeFinalReleaseGovernanceGatePolicy;
  const blockers = reports.runtimeFinalReleaseGovernanceGateBlockerReport;
  const checklist = reports.runtimeFinalReleaseGovernanceGateReadinessChecklist;

  const gateScopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenGateOperationRows = sliceOverlayRows(scope.forbiddenGateOperations, compactAndNarrowUi);
  const readinessChecklistRows = sliceOverlayRows(checklist.checklist, compactAndNarrowUi);
  const missingChecklistRows = sliceOverlayRows(checklist.missingRows, compactAndNarrowUi);
  const gateBlockerRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...blockers.blockers, ...summary.gateBlockers, ...checklist.blockers]).slice(0, 1)
    : mergeSortedUniqueKo([...blockers.blockers, ...summary.gateBlockers, ...checklist.blockers]);
  const recommendationRows = compactAndNarrowUi ? summary.recommendations.slice(0, 1) : [...summary.recommendations];

  const topGateBlocker =
    blockers.blockers[0] ?? summary.gateBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenGateOperation = scope.forbiddenGateOperations[0] ?? null;

  const gatePolicySummaryKo = [
    `allowedMode: ${RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO[policy.gateAllowedMode]}`,
    policy.operatorReviewBeforeFinalReleaseGate ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualExecutionForbidden: true",
    "actualExecutionBlockingForbidden: true",
    "actualMergeBlockingForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_SECTION_DISCLAIMER_KO,
    showAttention:
      summary.candidateStatus !== "final_release_governance_gate_metadata_candidate" ||
      summary.gateMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      !policy.actualExecutionForbidden ||
      !policy.actualExecutionRoutingForbidden ||
      !policy.actualReleaseEnforcementForbidden ||
      !policy.actualApprovalEnforcementForbidden ||
      !policy.actualExecutionBlockingForbidden ||
      !policy.actualMergeBlockingForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_CANDIDATE_STATUS_LABEL_KO[summary.candidateStatus],
    gateModeKo: RUNTIME_FINAL_RELEASE_GOVERNANCE_GATE_MODE_LABEL_KO[summary.gateMode],
    topGateBlocker,
    topForbiddenGateOperation,
    gatePolicySummaryKo,
    gateScopeSummaryRows,
    forbiddenGateOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    gateBlockerRows,
    recommendationRows,
  };
}
