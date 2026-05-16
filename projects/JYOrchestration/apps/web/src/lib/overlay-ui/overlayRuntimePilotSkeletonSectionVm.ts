/**
 * H28 — Overlay runtime **pilot skeleton** 섹션 VM.
 */

import type { RuntimeSemanticPlanningReports } from "@/lib/harness/runtimeSemantic/buildRuntimeSemanticPlanningReports";
import {
  RUNTIME_PILOT_RUNNER_MODE_LABEL_KO,
  RUNTIME_PILOT_SKELETON_READINESS_LABEL_KO,
  RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO,
} from "@/lib/harness/runtimePilotSkeleton/runtimePilotSkeletonLabelsKo";

export type OverlayRuntimePilotSkeletonSectionVM = Readonly<{
  sectionDisclaimer: string;
  showAttention: boolean;
  showDetailSections: boolean;
  skeletonReadinessKo: string;
  runnerModeKo: string;
  topSkeletonBlocker: string | null;
  topForbiddenRunnerOperation: string | null;
  contractRunnerName: string;
  inputEnvelopeSummaryRows: readonly string[];
  outputEnvelopeSummaryRows: readonly string[];
  forbiddenRunnerOperationRows: readonly string[];
  safetyGuardRows: readonly string[];
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
  const recommendationRows = compactAndNarrowUi ? s.recommendations.slice(0, 1) : [...s.recommendations];

  const topSkeletonBlocker = blockers.blockers[0] ?? s.skeletonBlockers[0] ?? null;
  const topForbiddenRunnerOperation = contract.forbiddenRunnerOperations[0] ?? null;

  return {
    sectionDisclaimer: RUNTIME_PILOT_SKELETON_SECTION_DISCLAIMER_KO,
    showAttention:
      s.skeletonReadiness !== "skeleton_metadata_ready" ||
      s.runnerMode === "blocked" ||
      blockers.blockers.length > 0,
    showDetailSections: !compactAndNarrowUi,
    skeletonReadinessKo: RUNTIME_PILOT_SKELETON_READINESS_LABEL_KO[s.skeletonReadiness],
    runnerModeKo: RUNTIME_PILOT_RUNNER_MODE_LABEL_KO[s.runnerMode],
    topSkeletonBlocker,
    topForbiddenRunnerOperation,
    contractRunnerName: contract.runnerName,
    inputEnvelopeSummaryRows,
    outputEnvelopeSummaryRows,
    forbiddenRunnerOperationRows,
    safetyGuardRows,
    recommendationRows,
  };
}
