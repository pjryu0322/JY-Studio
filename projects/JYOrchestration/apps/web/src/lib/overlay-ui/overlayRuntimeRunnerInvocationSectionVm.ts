/**
 * H29 — Overlay runtime **runner invocation candidate** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RUNNER_INVOCATION_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_RUNNER_INVOCATION_MODE_LABEL_KO,
  RUNTIME_RUNNER_INVOCATION_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeRunnerInvocation/runtimeRunnerInvocationLabelsKo";

export type OverlayRuntimeRunnerInvocationSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  invocationModeKo: string;
  topInvocationBlocker: string | null;
  topForbiddenInvocationOperation: string | null;
  invocationPolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenInvocationOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  invocationBlockerRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeRunnerInvocationSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeRunnerInvocationSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeRunnerInvocationSummary;
  const scope = reports.runtimeRunnerInvocationScope;
  const policy = reports.runtimeRunnerInvocationPolicy;
  const blockers = reports.runtimeRunnerInvocationBlockerReport;
  const checklist = reports.runtimeRunnerInvocationReadinessChecklist;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenInvocationOperationRows = compactAndNarrowUi
    ? scope.forbiddenInvocationOperations.slice(0, 1)
    : [...scope.forbiddenInvocationOperations];
  const readinessChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const missingChecklistRows = compactAndNarrowUi
    ? checklist.missingRows.slice(0, 1)
    : [...checklist.missingRows];
  const invocationBlockerRows = compactAndNarrowUi
    ? [...blockers.blockers.slice(0, 1), ...s.invocationBlockers.slice(0, 1)]
    : [...blockers.blockers, ...s.invocationBlockers];
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  const topInvocationBlocker = blockers.blockers[0] ?? s.invocationBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenInvocationOperation = scope.forbiddenInvocationOperations[0] ?? null;

  const invocationPolicySummaryKo = [
    `allowedMode: ${RUNTIME_RUNNER_INVOCATION_MODE_LABEL_KO[policy.invocationAllowedMode]}`,
    policy.operatorReviewBeforeInvocation ? "operatorReview: required" : "operatorReview: optional",
    policy.runnerContractRequired ? "runnerContract: required" : "runnerContract: optional",
    policy.runnerSafetyGuardRequired ? "runnerSafetyGuard: required" : "runnerSafetyGuard: optional",
    "actualInvocationForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_RUNNER_INVOCATION_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "invocation_metadata_candidate" ||
      s.invocationMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_RUNNER_INVOCATION_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    invocationModeKo: RUNTIME_RUNNER_INVOCATION_MODE_LABEL_KO[s.invocationMode],
    topInvocationBlocker,
    topForbiddenInvocationOperation,
    invocationPolicySummaryKo,
    scopeSummaryRows,
    forbiddenInvocationOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    invocationBlockerRows,
    recommendationRows,
  };
}
