/**
 * H30 / H30.5 — Overlay runtime **runner no-op harness** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_RUNNER_NOOP_HARNESS_ALIGNMENT_STATUS_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_FINAL_GATE_STATUS_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_MODE_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_READINESS_LABEL_KO,
  RUNTIME_RUNNER_NOOP_HARNESS_SECTION_DISCLAIMER_KO,
  runtimeRunnerNoopHarnessContractVerificationStatusKo,
  runtimeRunnerNoopHarnessReadinessVerificationStatusKo,
} from "@/lib/harness/runtimeRunnerNoopHarness/runtimeRunnerNoopHarnessLabelsKo";

export type OverlayRuntimeRunnerNoopHarnessSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  harnessReadinessKo: string;
  harnessModeKo: string;
  contractVerificationStatusKo: string;
  preflightReadinessKo: string;
  finalGateStatusKo: string;
  h31EntryReadinessKo: string;
  readinessVerificationStatusKo: string;
  alignmentStatusKo: string;
  topHarnessBlocker: string | null;
  topBoundaryViolation: string | null;
  topViolationOrBlocker: string | null;
  topAlignmentFinding: string | null;
  topReadinessFinding: string | null;
  noopResultSummaryKo: string;
  safetyGuardSummaryKo: string;
  envelopeRows: readonly string[];
  resultRows: readonly string[];
  guardRows: readonly string[];
  boundaryViolationRows: readonly string[];
  contractFindingRows: readonly string[];
  preflightChecklistRows: readonly string[];
  readinessFindingRows: readonly string[];
  alignmentFindingRows: readonly string[];
  finalGateChecklistRows: readonly string[];
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
  const verification = reports.runtimeRunnerNoopHarnessReadinessVerificationReport;
  const alignment = reports.runtimeRunnerNoopHarnessAlignmentReport;
  const gate = reports.runtimeRunnerNoopHarnessFinalSafetyGate;

  const envelopeRows = compactAndNarrowUi ? envelope.envelopeRows.slice(0, 1) : [...envelope.envelopeRows];
  const resultRows = compactAndNarrowUi ? result.resultRows.slice(0, 1) : [...result.resultRows];
  const guardRows = compactAndNarrowUi ? guard.guardRows.slice(0, 1) : [...guard.guardRows];
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const contractFindingRows = compactAndNarrowUi ? contract.findings.slice(0, 1) : [...contract.findings];
  const preflightChecklistRows = compactAndNarrowUi ? preflight.checklist.slice(0, 1) : [...preflight.checklist];
  const readinessFindingRows = compactAndNarrowUi ? verification.findings.slice(0, 1) : [...verification.findings];
  const alignmentFindingRows = compactAndNarrowUi ? alignment.findings.slice(0, 1) : [...alignment.findings];
  const finalGateChecklistRows = compactAndNarrowUi ? gate.checklist.slice(0, 1) : [...gate.checklist];
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...gate.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...gate.recommendations]);

  const topBoundaryViolation = boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topHarnessBlocker = s.harnessBlockers[0] ?? preflight.blockers[0] ?? gate.blockers[0] ?? null;
  const topReadinessFinding = verification.findings[0] ?? null;
  const topAlignmentFinding = alignment.findings[0] ?? null;
  const topViolationOrBlocker =
    topBoundaryViolation ?? topHarnessBlocker ?? topReadinessFinding ?? topAlignmentFinding ?? contract.findings[0] ?? null;

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
      gate.finalGateStatus !== "ready_metadata" ||
      verification.verificationStatus !== "verified_metadata" ||
      alignment.alignmentStatus !== "aligned_metadata" ||
      boundary.actualFlagViolations.length > 0 ||
      s.harnessMode === "blocked",
    showDetailSections: !compactAndNarrowUi,
    harnessReadinessKo: RUNTIME_RUNNER_NOOP_HARNESS_READINESS_LABEL_KO[s.harnessReadiness],
    harnessModeKo: RUNTIME_RUNNER_NOOP_HARNESS_MODE_LABEL_KO[s.harnessMode],
    contractVerificationStatusKo: runtimeRunnerNoopHarnessContractVerificationStatusKo(
      contract.verificationStatus
    ),
    preflightReadinessKo: RUNTIME_RUNNER_NOOP_HARNESS_PREFLIGHT_READINESS_LABEL_KO[preflight.preflightReadiness],
    finalGateStatusKo: RUNTIME_RUNNER_NOOP_HARNESS_FINAL_GATE_STATUS_LABEL_KO[gate.finalGateStatus],
    h31EntryReadinessKo: RUNTIME_RUNNER_NOOP_HARNESS_FINAL_GATE_STATUS_LABEL_KO[gate.h31EntryReadiness],
    readinessVerificationStatusKo: runtimeRunnerNoopHarnessReadinessVerificationStatusKo(
      verification.verificationStatus
    ),
    alignmentStatusKo: RUNTIME_RUNNER_NOOP_HARNESS_ALIGNMENT_STATUS_LABEL_KO[alignment.alignmentStatus],
    topHarnessBlocker,
    topBoundaryViolation,
    topViolationOrBlocker,
    topAlignmentFinding,
    topReadinessFinding,
    noopResultSummaryKo,
    safetyGuardSummaryKo,
    envelopeRows,
    resultRows,
    guardRows,
    boundaryViolationRows,
    contractFindingRows,
    preflightChecklistRows,
    readinessFindingRows,
    alignmentFindingRows,
    finalGateChecklistRows,
    recommendationRows,
  };
}
