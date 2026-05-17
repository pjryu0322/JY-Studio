/**
 * H32 — Overlay **controlled no-op execution shell harness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_MODE_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_READINESS_LABEL_KO,
  RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimeNoopExecutionShellHarness/runtimeNoopExecutionShellHarnessLabelsKo";

export type OverlayRuntimeNoopExecutionShellHarnessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  harnessReadinessKo: string;
  harnessModeKo: string;
  preflightReadinessKo: string;
  contractBoundarySummaryKo: string;
  inputEnvelopeSummaryKo: string;
  outputEnvelopeSummaryKo: string;
  noopResultSummaryKo: string;
  safetyGuardSummaryKo: string;
  topHarnessBlocker: string | null;
  topViolationOrBlocker: string | null;
  contractBoundaryRows: readonly string[];
  inputEnvelopeRows: readonly string[];
  outputEnvelopeRows: readonly string[];
  guardRows: readonly string[];
  harnessBlockerRows: readonly string[];
  preflightChecklistRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeNoopExecutionShellHarnessSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeNoopExecutionShellHarnessSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeNoopExecutionShellHarnessSummary;
  const boundary = reports.runtimeNoopExecutionShellContractBoundary;
  const inputEnvelope = reports.runtimeNoopExecutionShellHarnessInputEnvelope;
  const outputEnvelope = reports.runtimeNoopExecutionShellHarnessOutputEnvelope;
  const result = reports.runtimeNoopExecutionShellNoopResultMetadata;
  const guard = reports.runtimeNoopExecutionShellHarnessSafetyGuard;
  const blockers = reports.runtimeNoopExecutionShellHarnessBlockerReport;
  const preflight = reports.runtimeNoopExecutionShellHarnessPreflightSummary;

  const contractBoundaryRows = compactAndNarrowUi
    ? boundary.forbiddenContractOperations.slice(0, 1)
    : [...boundary.forbiddenContractOperations.slice(0, 4)];
  const inputEnvelopeRows = compactAndNarrowUi ? inputEnvelope.envelopeRows.slice(0, 1) : [...inputEnvelope.envelopeRows];
  const outputEnvelopeRows = compactAndNarrowUi ? outputEnvelope.envelopeRows.slice(0, 1) : [...outputEnvelope.envelopeRows];
  const guardRows = compactAndNarrowUi ? guard.guardRows.slice(0, 1) : [...guard.guardRows];
  const harnessBlockerRows = compactAndNarrowUi
    ? [...s.harnessBlockers.slice(0, 1), ...blockers.blockers.slice(0, 1)]
    : mergeSortedUniqueKo([...s.harnessBlockers, ...blockers.blockers]);
  const preflightChecklistRows = compactAndNarrowUi ? preflight.checklist.slice(0, 1) : [...preflight.checklist];
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]);

  const topHarnessBlocker = s.harnessBlockers[0] ?? blockers.blockers[0] ?? preflight.blockers[0] ?? null;
  const topViolationOrBlocker = topHarnessBlocker;

  const contractBoundarySummaryKo = [
    `source: ${boundary.boundarySourceLayer}`,
    `target: ${boundary.boundaryTargetLayer}`,
    `requiredInputs: ${boundary.requiredContractInputs.length}`,
  ].join(" · ");

  const inputEnvelopeSummaryKo =
    inputEnvelope.envelopeRows[0] ?? `rows:${inputEnvelope.envelopeRows.length}`;
  const outputEnvelopeSummaryKo =
    outputEnvelope.envelopeRows[0] ?? `rows:${outputEnvelope.envelopeRows.length}`;

  const noopResultSummaryKo = [
    `noopShellExecuted: ${result.noopShellExecuted}`,
    `executionShellExecuted: ${result.executionShellExecuted}`,
    `diagnosticOnly: ${result.diagnosticOnly}`,
    `tokenEnforced: ${result.tokenEnforced}`,
    `contextPruned: ${result.contextPruned}`,
  ].join(" · ");

  const safetyGuardSummaryKo = [
    "actualShellExecutionForbidden: true",
    "actualExecutionForbidden: true",
    "actualTokenEnforcementForbidden: true",
    "actualContextPruningForbidden: true",
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_SECTION_DISCLAIMER_KO,
    showAttention:
      s.harnessReadiness !== "shell_harness_metadata_ready" ||
      s.harnessMode === "blocked" ||
      preflight.preflightReadiness !== "ready_metadata" ||
      s.harnessBlockers.length > 0 ||
      blockers.blockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    harnessReadinessKo: RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_READINESS_LABEL_KO[s.harnessReadiness],
    harnessModeKo: RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_MODE_LABEL_KO[s.harnessMode],
    preflightReadinessKo: RUNTIME_NOOP_EXECUTION_SHELL_HARNESS_PREFLIGHT_READINESS_LABEL_KO[preflight.preflightReadiness],
    contractBoundarySummaryKo,
    inputEnvelopeSummaryKo,
    outputEnvelopeSummaryKo,
    noopResultSummaryKo,
    safetyGuardSummaryKo,
    topHarnessBlocker,
    topViolationOrBlocker,
    contractBoundaryRows,
    inputEnvelopeRows,
    outputEnvelopeRows,
    guardRows,
    harnessBlockerRows,
    preflightChecklistRows,
    recommendationRows,
  };
}
