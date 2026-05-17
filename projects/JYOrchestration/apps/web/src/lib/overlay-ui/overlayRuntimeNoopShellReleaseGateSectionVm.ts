/**
 * H34 — Overlay runtime **no-op shell release-gate candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_SHELL_RELEASE_GATE_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO,
  RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeNoopShellReleaseGate/runtimeNoopShellReleaseGateLabelsKo";

export type OverlayRuntimeNoopShellReleaseGateSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  releaseGateModeKo: string;
  topReleaseGateBlocker: string | null;
  topForbiddenReleaseGateOperation: string | null;
  topViolationOrBlocker: string | null;
  releaseGatePolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenReleaseGateOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  releaseGateBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeNoopShellReleaseGateSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeNoopShellReleaseGateSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeNoopShellReleaseGateSummary;
  const scope = reports.runtimeNoopShellReleaseGateScope;
  const policy = reports.runtimeNoopShellReleaseGatePolicy;
  const blockers = reports.runtimeNoopShellReleaseGateBlockerReport;
  const checklist = reports.runtimeNoopShellReleaseGateReadinessChecklist;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenReleaseGateOperationRows = compactAndNarrowUi
    ? scope.forbiddenReleaseGateOperations.slice(0, 1)
    : [...scope.forbiddenReleaseGateOperations];
  const readinessChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const missingChecklistRows = compactAndNarrowUi
    ? checklist.missingRows.slice(0, 1)
    : [...checklist.missingRows];
  const releaseGateBlockerRows = compactAndNarrowUi
    ? [...blockers.blockers.slice(0, 1), ...s.releaseGateBlockers.slice(0, 1)]
    : mergeSortedUniqueKo([...blockers.blockers, ...s.releaseGateBlockers]);
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...checklist.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...checklist.recommendations]);

  const topReleaseGateBlocker =
    blockers.blockers[0] ?? s.releaseGateBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenReleaseGateOperation = scope.forbiddenReleaseGateOperations[0] ?? null;
  const topViolationOrBlocker = topReleaseGateBlocker ?? topForbiddenReleaseGateOperation;

  const releaseGatePolicySummaryKo = [
    `allowedMode: ${RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO[policy.releaseGateAllowedMode]}`,
    policy.operatorReviewBeforeReleaseGate ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualReleaseEnforcementForbidden: true",
    "actualShellExecutionForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_NOOP_SHELL_RELEASE_GATE_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "release_gate_metadata_candidate" ||
      s.releaseGateMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      !policy.actualReleaseEnforcementForbidden,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    releaseGateModeKo: RUNTIME_NOOP_SHELL_RELEASE_GATE_MODE_LABEL_KO[s.releaseGateMode],
    topReleaseGateBlocker,
    topForbiddenReleaseGateOperation,
    topViolationOrBlocker,
    releaseGatePolicySummaryKo,
    scopeSummaryRows,
    forbiddenReleaseGateOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    releaseGateBlockerRows,
    recommendationRows,
  };
}
