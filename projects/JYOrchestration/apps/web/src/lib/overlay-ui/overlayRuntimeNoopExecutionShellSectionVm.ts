/**
 * H31 / H31.5 — Overlay runtime **no-op execution shell candidate** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_EXECUTION_SHELL_CANDIDATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO,
  runtimeNoopExecutionShellReadinessVerificationStatusKo,
} from "@/lib/harness/runtimeNoopExecutionShell/runtimeNoopExecutionShellLabelsKo";

export type OverlayRuntimeNoopExecutionShellSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  candidateStatusKo: string;
  shellModeKo: string;
  finalGateStatusKo: string;
  h32EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  topShellBlocker: string | null;
  topBoundaryViolation: string | null;
  topForbiddenShellOperation: string | null;
  topViolationOrBlocker: string | null;
  topReadinessFinding: string | null;
  shellPolicySummaryKo: string;
  scopeSummaryRows: readonly string[];
  forbiddenShellOperationRows: readonly string[];
  readinessChecklistRows: readonly string[];
  missingChecklistRows: readonly string[];
  shellBlockerRows: readonly string[];
  boundaryViolationRows: readonly string[];
  readinessFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
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
  const gate = reports.runtimeNoopExecutionShellFinalSafetyGate;
  const boundary = reports.runtimeNoopExecutionShellBoundaryViolationReport;
  const verification = reports.runtimeNoopExecutionShellReadinessVerificationReport;

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
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const readinessFindingRows = compactAndNarrowUi
    ? verification.findings.slice(0, 1)
    : [...verification.findings];
  const finalGateChecklistRows = compactAndNarrowUi ? gate.checklist.slice(0, 1) : [...gate.checklist];
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...gate.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...gate.recommendations]);

  const topBoundaryViolation =
    boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topShellBlocker = blockers.blockers[0] ?? s.shellBlockers[0] ?? checklist.blockers[0] ?? gate.blockers[0] ?? null;
  const topReadinessFinding = verification.findings[0] ?? null;
  const topForbiddenShellOperation = scope.forbiddenShellOperations[0] ?? null;
  const topViolationOrBlocker = topBoundaryViolation ?? topShellBlocker ?? topReadinessFinding;

  const shellPolicySummaryKo = [
    `allowedMode: ${RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO[policy.shellAllowedMode]}`,
    policy.operatorReviewBeforeShell ? "operatorReview: required" : "operatorReview: optional",
    policy.rollbackReadinessRequired ? "rollbackReadiness: required" : "rollbackReadiness: optional",
    policy.auditTraceRequired ? "auditTrace: required" : "auditTrace: optional",
    "actualShellExecutionForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_NOOP_EXECUTION_SHELL_SECTION_DISCLAIMER_KO,
    showAttention:
      s.candidateStatus !== "shell_metadata_candidate" ||
      gate.finalGateStatus !== "ready_metadata" ||
      gate.h32EntryReadiness !== "ready_metadata" ||
      s.shellMode === "blocked" ||
      blockers.blockers.length > 0 ||
      checklist.missingRows.length > 0 ||
      boundary.actualFlagViolations.length > 0 ||
      verification.verificationStatus !== "verified_metadata",
    showDetailSections: !compactAndNarrowUi,
    candidateStatusKo: RUNTIME_NOOP_EXECUTION_SHELL_CANDIDATE_STATUS_LABEL_KO[s.candidateStatus],
    shellModeKo: RUNTIME_NOOP_EXECUTION_SHELL_MODE_LABEL_KO[s.shellMode],
    finalGateStatusKo: RUNTIME_NOOP_EXECUTION_SHELL_FINAL_GATE_STATUS_LABEL_KO[gate.finalGateStatus],
    h32EntryReadinessKo: RUNTIME_NOOP_EXECUTION_SHELL_FINAL_GATE_STATUS_LABEL_KO[gate.h32EntryReadiness],
    readinessVerificationStatusKo: runtimeNoopExecutionShellReadinessVerificationStatusKo(
      verification.verificationStatus
    ),
    topShellBlocker,
    topBoundaryViolation,
    topForbiddenShellOperation,
    topViolationOrBlocker,
    topReadinessFinding,
    shellPolicySummaryKo,
    scopeSummaryRows,
    forbiddenShellOperationRows,
    readinessChecklistRows,
    missingChecklistRows,
    shellBlockerRows,
    boundaryViolationRows,
    readinessFindingRows,
    finalGateChecklistRows,
    recommendationRows,
  };
}
