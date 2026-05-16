/**
 * H31 — Overlay runtime **no-op execution shell candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_EXECUTION_SHELL_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeNoopExecutionShell/runtimeNoopExecutionShellLabelsKo";

export type OverlayRuntimeNoopExecutionShellSectionVM = Readonly<{
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

export function buildOverlayRuntimeNoopExecutionShellSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeNoopExecutionShellSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeNoopExecutionShellSummary;
  const scope = reports.runtimeNoopExecutionShellScope;
  const policy = reports.runtimeNoopExecutionShellPolicy;
  const blockers = reports.runtimeNoopExecutionShellBlockerReport;
  const checklist = reports.runtimeNoopExecutionShellReadinessChecklist;
  const harnessGate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;

  const scopeSummaryRows = compactAndNarrowUi
    ? [scope.candidateSourceLayer].slice(0, 1)
    : [
        `source: ${scope.candidateSourceLayer}`,
        `target: ${scope.candidateTargetLayer}`,
        ...scope.requiredInputMetadata.slice(0, 2),
        ...scope.expectedOutputMetadata.slice(0, 2),
      ];
  const forbiddenShellOperationRows = compactAndNarrowUi
    ? scope.forbiddenShellOperations.slice(0, 1)
    : [...scope.forbiddenShellOperations];
  const readinessChecklistRows = compactAndNarrowUi
    ? checklist.checklist.slice(0, 1)
    : [...checklist.checklist];
  const missingChecklistRows = compactAndNarrowUi
    ? checklist.missingRows.slice(0, 1)
    : [...checklist.missingRows];
  const shellBlockerRows = compactAndNarrowUi
    ? [...blockers.blockers.slice(0, 1), ...s.shellBlockers.slice(0, 1)]
    : mergeSortedUniqueKo([...blockers.blockers, ...s.shellBlockers]);
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...checklist.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...checklist.recommendations]);

  const topShellBlocker = blockers.blockers[0] ?? s.shellBlockers[0] ?? checklist.blockers[0] ?? null;
  const topForbiddenShellOperation = scope.forbiddenShellOperations[0] ?? null;
  const topViolationOrBlocker = topShellBlocker ?? topForbiddenShellOperation;

  const shellPolicySummaryKo = [
    `allowedMode: ${RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO[policy.shellAllowedMode]}`,
    policy.operatorReviewBeforeShell ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualShellExecutionForbidden: true",
    `h31Entry: ${harnessGate.h31EntryReadiness}`,
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "shell_metadata_candidate" ||
      harnessGate.finalGateStatus !== "ready_metadata" ||
      harnessGate.h31EntryReadiness !== "ready_metadata" ||
      s.shellMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0,
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_NOOP_EXECUTION_SHELL_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    shellModeKo: RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO[s.shellMode],
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
