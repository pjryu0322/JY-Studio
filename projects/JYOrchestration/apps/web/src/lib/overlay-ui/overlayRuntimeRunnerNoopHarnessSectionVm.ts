/**
 * H30 — Overlay runtime **runner no-op harness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RUNNER_NOOP_HARNESS_MODE_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_READINESS_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_SECTION_DISCLAIMER_KO,
  runtimeRunnerNoopHarnessContractVerificationStatusKo,
} from "@/lib/harness/runtimeRunnerNoopHarness/runtimeRunnerNoopHarnessLabelsKo";

export type OverlayRuntimeRunnerNoopHarnessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  harnessReadinessKo: string;
  harnessModeKo: string;
  contractVerificationStatusKo: string;
  preflightReadinessKo: string;
  topHarnessBlocker: string | null;
  topBoundaryViolation: string | null;
  topViolationOrBlocker: string | null;
  noopResultSummaryKo: string;
  safetyGuardSummaryKo: string;
  envelopeRows: readonly string[];
  resultRows: readonly string[];
  guardRows: readonly string[];
  boundaryViolationRows: readonly string[];
  contractFindingRows: readonly string[];
  preflightChecklistRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimeRunnerNoopHarnessSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimeRunnerNoopHarnessSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimeRunnerNoopHarnessSummary;
  const envelope = reports.runtimeRunnerNoopInvocationEnvelope;
  const result = reports.runtimeRunnerNoopResultMetadata;
  const guard = reports.runtimeRunnerNoopHarnessSafetyGuard;
  const contract = reports.runtimeRunnerNoopHarnessContractVerificationReport;
  const boundary = reports.runtimeRunnerNoopHarnessBoundaryViolationReport;
  const preflight = reports.runtimeRunnerNoopHarnessPreflightSummary;

  const envelopeRows = compactAndNarrowUi ? envelope.envelopeRows.slice(0, 1) : [...envelope.envelopeRows];
  const resultRows = compactAndNarrowUi ? result.resultRows.slice(0, 1) : [...result.resultRows];
  const guardRows = compactAndNarrowUi ? guard.guardRows.slice(0, 1) : [...guard.guardRows];
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const contractFindingRows = compactAndNarrowUi ? contract.findings.slice(0, 1) : [...contract.findings];
  const preflightChecklistRows = compactAndNarrowUi ? preflight.checklist.slice(0, 1) : [...preflight.checklist];
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]);

  const topBoundaryViolation = boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topHarnessBlocker = s.harnessBlockers[0] ?? preflight.blockers[0] ?? null;
  const topViolationOrBlocker = topBoundaryViolation ?? topHarnessBlocker ?? contract.findings[0] ?? null;

  const noopResultSummaryKo = compactAndNarrowUi
    ? `diagnosticOnly: ${result.diagnosticOnly}`
    : result.resultRows.join(" · ");
  const safetyGuardSummaryKo = compactAndNarrowUi
    ? "actualInvocationForbidden: true"
    : guard.guardRows.slice(0, 4).join(" · ");

  return {
    sectionDisclaimer: RUNTIME_RUNNER_NOOP_HARNESS_SECTION_DISCLAIMER_KO,
    showAttention:
      s.harnessReadiness !== "noop_harness_metadata_ready" ||
      preflight.preflightReadiness !== "ready_metadata" ||
      contract.verificationStatus !== "verified_metadata" ||
      boundary.actualFlagViolations.length > 0 ||
      s.harnessMode === "blocked",
    showDetailSections: !compactAndNarrowUi,
    harnessReadinessKo: RUNTIME_RUNNER_NOOP_HARNESS_READINESS_LABEL_KO[s.harnessReadiness],
    harnessModeKo: RUNTIME_RUNNER_NOOP_HARNESS_MODE_LABEL_KO[s.harnessMode],
    contractVerificationStatusKo: runtimeRunnerNoopHarnessContractVerificationStatusKo(
      contract.verificationStatus
    ),
    preflightReadinessKo: RUNTIME_RUNNER_NOOP_HARNESS_PREFLIGHT_READINESS_LABEL_KO[preflight.preflightReadiness],
    topHarnessBlocker,
    topBoundaryViolation,
    topViolationOrBlocker,
    noopResultSummaryKo,
    safetyGuardSummaryKo,
    envelopeRows,
    resultRows,
    guardRows,
    boundaryViolationRows,
    contractFindingRows,
    preflightChecklistRows,
    recommendationRows,
  };
}
