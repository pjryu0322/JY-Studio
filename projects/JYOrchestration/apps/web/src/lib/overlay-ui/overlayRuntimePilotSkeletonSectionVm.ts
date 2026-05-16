/**
 * H28 / H28.5 — Overlay runtime **pilot skeleton** 섹션 VM.
 */

import { mergeSortedUniqueKo } from "@/lib/harness/runtimeExecutionCandidate/runtimeExecutionCandidateMerge";
import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_PILOT_RUNNER_MODE_LABEL_KO,
  RUNTIME_PILOT_SKELETON_PREFLIGHT_READINESS_LABEL_KO,
  RUNTIME_PILOT_SKELETON_READINESS_LABEL_KO,
  RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO,
  runtimePilotRunnerContractVerificationStatusKo,
} from "@/lib/harness/runtimePilotSkeleton/runtimePilotSkeletonLabelsKo";

export type OverlayRuntimePilotSkeletonSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  skeletonReadinessKo: string;
  runnerModeKo: string;
  contractVerificationStatusKo: string;
  preflightReadinessKo: string;
  topSkeletonBlocker: string | null;
  topBoundaryViolation: string | null;
  topContractFinding: string | null;
  topViolationOrBlocker: string | null;
  topForbiddenRunnerOperation: string | null;
  noExecutionResultSummaryKo: string;
  contractRunnerName: string;
  inputEnvelopeSummaryRows: readonly string[];
  outputEnvelopeSummaryRows: readonly string[];
  forbiddenRunnerOperationRows: readonly string[];
  safetyGuardRows: readonly string[];
  boundaryViolationRows: readonly string[];
  contractFindingRows: readonly string[];
  noExecutionResultRows: readonly string[];
  preflightChecklistRows: readonly string[];
  recommendationRows: readonly string[];
}>;

export function buildOverlayRuntimePilotSkeletonSectionVmFromReports(
  reports: RuntimeSemanticPlanningReports,
  options?: Readonly<{ compactAndNarrowUi?: boolean }>
): OverlayRuntimePilotSkeletonSectionVM {
  const compactAndNarrowUi = options?.compactAndNarrowUi ?? false;
  const s = reports.runtimePilotSkeletonSummary;
  const contract = reports.runtimeDryRunRunnerContract;
  const input = reports.runtimePilotRunnerInputEnvelope;
  const output = reports.runtimePilotRunnerOutputEnvelope;
  const guard = reports.runtimePilotRunnerSafetyGuard;
  const blockers = reports.runtimePilotSkeletonBlockerReport;
  const verification = reports.runtimePilotRunnerContractVerificationReport;
  const boundary = reports.runtimePilotRunnerBoundaryViolationReport;
  const noExecution = reports.runtimePilotRunnerNoExecutionResultMetadata;
  const preflight = reports.runtimePilotSkeletonPreflightSummary;

  const inputEnvelopeSummaryRows = compactAndNarrowUi
    ? input.envelopeRows.slice(0, 1)
    : input.envelopeRows.slice(0, 6);
  const outputEnvelopeSummaryRows = compactAndNarrowUi
    ? [...output.acceptedMetadataRows.slice(0, 1), ...output.safetyEnvelopeRows.slice(0, 1)]
    : [...output.acceptedMetadataRows, ...output.safetyEnvelopeRows];
  const forbiddenRunnerOperationRows = compactAndNarrowUi
    ? contract.forbiddenRunnerOperations.slice(0, 1)
    : [...contract.forbiddenRunnerOperations];
  const safetyGuardRows = compactAndNarrowUi ? guard.guardRows.slice(0, 1) : [...guard.guardRows];
  const boundaryViolationRows = compactAndNarrowUi
    ? [...boundary.actualFlagViolations.slice(0, 1), ...boundary.wordingRiskFindings.slice(0, 1)]
    : [...boundary.actualFlagViolations, ...boundary.wordingRiskFindings];
  const contractFindingRows = compactAndNarrowUi
    ? verification.findings.slice(0, 1)
    : [...verification.findings];
  const noExecutionResultRows = compactAndNarrowUi
    ? noExecution.resultRows.slice(0, 1)
    : [...noExecution.resultRows];
  const preflightChecklistRows = compactAndNarrowUi ? preflight.checklist.slice(0, 1) : [...preflight.checklist];
  const recommendationRows = compactAndNarrowUi
    ? mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]).slice(0, 1)
    : mergeSortedUniqueKo([...s.recommendations, ...preflight.recommendations]);

  const topBoundaryViolation =
    boundary.actualFlagViolations[0] ?? boundary.wordingRiskFindings[0] ?? null;
  const topSkeletonBlocker = blockers.blockers[0] ?? s.skeletonBlockers[0] ?? preflight.blockers[0] ?? null;
  const topContractFinding = verification.findings[0] ?? null;
  const topViolationOrBlocker = topBoundaryViolation ?? topSkeletonBlocker ?? topContractFinding;
  const topForbiddenRunnerOperation = contract.forbiddenRunnerOperations[0] ?? null;

  const noExecutionResultSummaryKo = [
    `runnerExecuted: ${noExecution.runnerExecuted}`,
    `dryRunRunnerExecuted: ${noExecution.dryRunRunnerExecuted}`,
    `diagnosticOnly: ${noExecution.diagnosticOnly}`,
  ].join(" · ");

  return {
    sectionDisclaimer: RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO,
    showAttention:
      s.skeletonReadiness !== "skeleton_metadata_ready" ||
      s.runnerMode === "blocked" ||
      preflight.preflightReadiness !== "ready_metadata" ||
      blockers.blockers.length > 0 ||
      boundary.actualFlagViolations.length > 0 ||
      verification.verificationStatus !== "verified_metadata",
    showDetailSections: !compactAndNarrowUi,
    skeletonReadinessKo: RUNTIME_PILOT_SKELETON_READINESS_LABEL_KO[s.skeletonReadiness],
    runnerModeKo: RUNTIME_PILOT_RUNNER_MODE_LABEL_KO[s.runnerMode],
    contractVerificationStatusKo: runtimePilotRunnerContractVerificationStatusKo(verification.verificationStatus),
    preflightReadinessKo: RUNTIME_PILOT_SKELETON_PREFLIGHT_READINESS_LABEL_KO[preflight.preflightReadiness],
    topSkeletonBlocker,
    topBoundaryViolation,
    topContractFinding,
    topViolationOrBlocker,
    topForbiddenRunnerOperation,
    noExecutionResultSummaryKo,
    contractRunnerName: contract.runnerName,
    inputEnvelopeSummaryRows,
    outputEnvelopeSummaryRows,
    forbiddenRunnerOperationRows,
    safetyGuardRows,
    boundaryViolationRows,
    contractFindingRows,
    noExecutionResultRows,
    preflightChecklistRows,
    recommendationRows,
  };
}
